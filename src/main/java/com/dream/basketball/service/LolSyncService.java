package com.dream.basketball.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.LolAccount;
import com.dream.basketball.entity.LolMatch;
import com.dream.basketball.entity.LolMatchPlayer;
import com.dream.basketball.entity.LolSummoner;
import com.dream.basketball.mapper.LolAccountMapper;
import com.dream.basketball.mapper.LolMatchMapper;
import com.dream.basketball.mapper.LolMatchPlayerMapper;
import com.dream.basketball.mapper.LolSummonerMapper;
import com.dream.basketball.mapper.UserMapper;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * 开黑战绩的抓取与入库。
 *
 * <h2>整体形状</h2>
 *
 * <pre>
 *   绑定   Riot ID --account-v1--> PUUID，存库，标记待回填
 *   回填   PUUID --match-v5 ids(100)--> 一批 matchId --> 逐个 ingest
 *   轮询   PUUID --match-v5 ids(5)---> 最近几场       --> 逐个 ingest
 * </pre>
 *
 * <h2>ingest 为什么对「已有」和「新」用同一条路径</h2>
 *
 * 一场五黑对五个人是**同一个 matchId**。谁先被轮询到，这场就由谁带进库。
 * 于是必然出现两种情况，而且必须都处理对：
 *
 * <ol>
 *   <li>这场还没入过库 —— 拉详情、存 {@code lol_match}（含原文 gzip）、写各人的行。</li>
 *   <li>这场已经在库里 —— <b>一次 API 都不该再调</b>。把 RAW_GZ 解开，
 *       从里面取出还缺的那几个人的行。</li>
 * </ol>
 *
 * 第二条正是**有人晚绑定**时的情形：他加入之前，他的历史对局早就被队友带进库了。
 * 没有 RAW_GZ 的话这里只能重新拉一遍 API，而回填 20 个人本来就是这个模块
 * 唯一会逼近限流的动作，能省下的这部分不是小数（实测重叠率 65%）。
 *
 * <h2>幂等</h2>
 *
 * 一切以 {@code MATCH_ID} 和 {@code (MATCH_ID, PUUID)} 主键为准，重复跑不会产生脏数据。
 * 所以「任务跑到一半重启」不需要任何断点续传的机制——下一轮自然会补上。
 */
@Service
public class LolSyncService {

    private static final Logger log = LoggerFactory.getLogger(LolSyncService.class);

    /** 首次绑定回填多少场。100 是 match-v5 单次返回的上限，再多要翻页 */
    private static final int BACKFILL_SIZE = 100;
    /** 常规轮询每次看最近几场。一个人两次轮询之间打不完 5 局，留足冗余 */
    private static final int POLL_SIZE = 5;
    /** 一轮花在回填上的时间上限。够补一两个人，又不至于让下一轮的轮询迟到太久 */
    private static final long BACKFILL_BUDGET_MS = 3 * 60 * 1000L;
    /** 段位多久刷一次。段位变化是以天计的，一小时足够及时 */
    private static final long RANK_TTL_MS = 60 * 60 * 1000L;
    /**
     * 每轮补几个路人的段位。
     *
     * <p>库里几千个人，一轮 30 个、五分钟一轮 ≈ 每小时 360 个，十来个小时补完。
     * 想更快就是拿配额换，而配额是给「新对局要及时进来」留的——
     * 那个是每天都在用的，路人段位是一次性的。
     */
    private static final int RANK_FILL_PER_ROUND = 30;
    /** 每轮补扫几场老对局的参与者名单。解压 + 解析是本地开销，可以给得大方些 */
    private static final int SCAN_PER_ROUND = 120;

    @Autowired
    private RiotApiClient riot;
    @Autowired
    private LolAccountMapper accountMapper;
    @Autowired
    private LolMatchMapper matchMapper;
    @Autowired
    private LolMatchPlayerMapper playerMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private LolSummonerMapper summonerMapper;

    // ───────────────────────────────────────────── 绑定

    /**
     * 绑定一个 Riot 账号。返回绑定好的记录。
     *
     * <p>解析失败（Riot ID 不存在）会带着 404 抛出去，由 controller 翻译成人话——
     * 这是用户唯一会直接撞到 Riot 报错的地方，措辞要指向「名字打错了」而不是「服务异常」。
     */
    public LolAccount bind(String userId, String gameName, String tagLine, String platform, String region) {
        JSONObject acct = riot.accountByRiotId(gameName, tagLine);
        String puuid = acct.getString("puuid");
        if (StringUtils.isBlank(puuid)) {
            throw new IllegalStateException("Riot 没返回 puuid");
        }
        // 同一个游戏账号不允许被两个人认领。这里主动查一次是为了给出人话提示，
        // 光靠唯一索引的话用户看到的是一条数据库异常
        LolAccount exist = accountMapper.selectOne(
                new QueryWrapper<LolAccount>().eq("PUUID", puuid).last("limit 1"));
        if (exist != null) {
            if (StringUtils.equals(exist.getUserId(), userId)) {
                return exist;                       // 重复绑定自己的号：当成幂等操作
            }
            throw new IllegalStateException("这个游戏账号已经被其他成员绑定了");
        }
        LolAccount a = new LolAccount();
        a.setAccountId(UUID.randomUUID().toString());
        a.setUserId(userId);
        // 用 Riot 返回的大小写而不是用户输入的——同一个名字用户可能打成 epoch/Epoch，
        // 存 Riot 的版本才能和游戏里显示的一致
        a.setGameName(acct.getString("gameName"));
        a.setTagLine(acct.getString("tagLine"));
        a.setPuuid(puuid);
        a.setPlatform(StringUtils.defaultIfBlank(platform, "oc1"));
        a.setRegion(StringUtils.defaultIfBlank(region, "sea"));
        a.setEnabled("1");
        a.setBackfilled("0");
        a.setBindTime(new Date());
        accountMapper.insert(a);
        log.info("LoL 绑定 user={} riotId={}#{}", userId, a.getGameName(), a.getTagLine());
        return a;
    }

    /** 解绑：连同这个号的对局行一起删掉。对局本身留着——它可能还挂着别人 */
    public void unbind(String userId, String accountId) {
        LolAccount a = accountMapper.selectById(accountId);
        if (a == null || !StringUtils.equals(a.getUserId(), userId)) {
            return;
        }
        playerMapper.delete(new QueryWrapper<LolMatchPlayer>().eq("PUUID", a.getPuuid()));
        accountMapper.deleteById(accountId);
        log.info("LoL 解绑 user={} riotId={}#{}", userId, a.getGameName(), a.getTagLine());
    }

    // ───────────────────────────────────────────── 抓取

    /**
     * 跑一轮。顺序是**先轮询、再刷段位、最后回填**，三步各有理由。
     *
     * <h3>轮询排在最前</h3>
     * 每个账号 1 次请求，二十个人也才二十次。放在最前面保证**每一轮都会把新对局收进来**，
     * 不会因为这一轮正好在补某人的历史就让所有人的新对局迟到。
     *
     * <h3>回填按 BIND_TIME 先到先得，而且有时间预算</h3>
     * 早先这里既没排序也只补一个：`selectList` 不带 ORDER BY 时返回的是**主键（随机 UUID）顺序**，
     * 于是每轮挑中的是「UUID 最小的那个待回填账号」，和谁先绑的毫无关系。
     * 实测过一次：16:12 绑的账号连输两轮，被 16:20 才绑的账号插了队——
     * 而只要新人不断加入，UUID 排在后面的可能**一直排不上队**。
     * 现在按绑定时间排，先绑先补；再配一个时间预算，一轮能补几个就补几个，
     * 二十个人不必等上一百分钟。
     */
    public SyncReport runOnce() {
        SyncReport r = new SyncReport();
        if (!riot.isConfigured()) {
            r.skipped = "RIOT_API_KEY 没配置";
            return r;
        }
        List<LolAccount> accounts = accountMapper.selectList(
                new QueryWrapper<LolAccount>().eq("ENABLED", "1").orderByAsc("BIND_TIME"));
        if (accounts.isEmpty()) {
            return r;
        }
        Set<String> bound = new HashSet<>();
        Map<String, String> puuidToUser = new HashMap<>();
        for (LolAccount a : accounts) {
            bound.add(a.getPuuid());
            puuidToUser.put(a.getPuuid(), a.getUserId());
        }

        // 1) 轮询已经回填过的账号
        for (LolAccount a : accounts) {
            if ("1".equals(a.getBackfilled())) {
                r.polled += syncAccount(a, bound, puuidToUser, POLL_SIZE, r);
            }
        }

        // 2) 段位（只刷过期的；一小时一次，几个人的量可以忽略）
        for (LolAccount a : accounts) {
            if (a.getRankUpdated() == null
                    || System.currentTimeMillis() - a.getRankUpdated().getTime() > RANK_TTL_MS) {
                refreshRank(a, r);
            }
        }

        // 3) 回填，先绑先补，用完预算就留到下一轮
        long deadline = System.currentTimeMillis() + BACKFILL_BUDGET_MS;
        for (LolAccount a : accounts) {
            if ("1".equals(a.getBackfilled())) {
                continue;
            }
            if (System.currentTimeMillis() > deadline) {
                break;
            }
            r.backfilled += syncAccount(a, bound, puuidToUser, BACKFILL_SIZE, r);
            a.setBackfilled("1");
            accountMapper.updateById(a);
            r.backfilledAccounts++;
        }

        // 4) 登记老对局里的人（纯本地开销，不打 Riot）
        r.scanned = scanOldMatches();
        // 5) 补路人段位。放最后：它是长尾任务，前面几步都比它急
        r.ranksFilled = fillSummonerRanks(r);
        r.ranksPending = summonerMapper.pendingRankCount();
        return r;
    }

    /** 刷一个账号的当前段位。取单双排那条；没打排位就留空 */
    private void refreshRank(LolAccount a, SyncReport r) {
        try {
            JSONObject solo = pickSolo(riot.leagueEntries(a.getPlatform(), a.getPuuid()));
            a.setTier(solo == null ? null : solo.getString("tier"));
            a.setRankDiv(solo == null ? null : solo.getString("rank"));
            a.setLeaguePoint(solo == null ? null : solo.getInteger("leaguePoints"));
            a.setRankWins(solo == null ? null : solo.getInteger("wins"));
            a.setRankLosses(solo == null ? null : solo.getInteger("losses"));
            // 时间戳无论查到没查到都要更新，否则未定级的账号每轮都会再查一次
            a.setRankUpdated(new Date());
            accountMapper.updateById(a);
        } catch (RiotApiClient.RiotException e) {
            noteError(a, e, r);
        }
    }

    /** 拉一个账号的最近 n 场并入库，返回新增的对局数 */
    private int syncAccount(LolAccount a, Set<String> bound, Map<String, String> puuidToUser,
                            int n, SyncReport r) {
        List<String> ids;
        try {
            ids = riot.matchIds(a.getRegion(), a.getPuuid(), null, 0, n);
        } catch (RiotApiClient.RiotException e) {
            noteError(a, e, r);
            return 0;
        }
        int added = 0;
        for (String id : ids) {
            try {
                if (ingest(a.getRegion(), id, bound, puuidToUser)) {
                    added++;
                }
            } catch (RiotApiClient.RiotException e) {
                if (e.isNotFound()) {
                    // 这场对局 Riot 那边查不到（极少见）。记一笔别重试，
                    // 否则每一轮都会为它白打一次请求
                    log.warn("LoL 对局不存在，跳过 {}", id);
                    continue;
                }
                noteError(a, e, r);
                break;                               // 403/限流之类：这一轮别再打了
            }
        }
        a.setLastSync(new Date());
        a.setLastError(null);
        accountMapper.updateById(a);
        return added;
    }

    /**
     * 把一场对局入库。返回 true 表示这场是新拉的。
     *
     * <p>见类注释：已经在库里的场次**不会再调 API**，缺的人从 RAW_GZ 里补。
     */
    private boolean ingest(String region, String matchId, Set<String> bound, Map<String, String> puuidToUser) {
        LolMatch existing = matchMapper.selectById(matchId);
        String raw;
        boolean fresh = false;
        if (existing != null) {
            raw = gunzip(existing.getRawGz());
            if (raw == null) {
                return false;                        // 老数据没存原文，没得补，跳过
            }
        } else {
            raw = riot.matchDetailRaw(region, matchId);
            fresh = true;
        }

        JSONObject root = JSON.parseObject(raw);
        JSONObject info = root.getJSONObject("info");
        if (info == null) {
            return false;
        }
        if (fresh) {
            LolMatch m = new LolMatch();
            m.setMatchId(matchId);
            m.setPlatform(info.getString("platformId"));
            m.setQueueId(info.getInteger("queueId"));
            m.setGameMode(info.getString("gameMode"));
            Long start = info.getLong("gameStartTimestamp");
            m.setGameStart(new Date(start == null ? System.currentTimeMillis() : start));
            m.setGameDuration(info.getInteger("gameDuration"));
            m.setGameVersion(info.getString("gameVersion"));
            m.setEndResult(info.getString("endOfGameResult"));
            m.setRawGz(gzip(raw));
            m.setCreateTime(new Date());
            matchMapper.insert(m);
        }

        JSONArray parts = info.getJSONArray("participants");
        if (parts == null) {
            return fresh;
        }
        // 顺手把这一场的**十个人**登记进 lol_summoner（含路人）。
        // 在这里做而不是以后回头解压 RAW_GZ 找：这一刻 JSON 已经解析好在手上，
        // 顺带写十行的代价接近零；事后补则要把几百场重新解压一遍
        if (fresh) {
            registerParticipants(matchId, info, parts);
        }
        for (int i = 0; i < parts.size(); i++) {
            JSONObject p = parts.getJSONObject(i);
            String puuid = p.getString("puuid");
            if (puuid == null || !bound.contains(puuid)) {
                continue;                            // 路人不存，需要时从 RAW_GZ 取
            }
            // selectCount 在本项目的 MyBatis-Plus 版本里返回 Integer，不是 Long
            Integer already = playerMapper.selectCount(new QueryWrapper<LolMatchPlayer>()
                    .eq("MATCH_ID", matchId).eq("PUUID", puuid));
            if (already != null && already > 0) {
                continue;
            }
            playerMapper.insert(toPlayerRow(matchId, puuid, puuidToUser.get(puuid), p));
        }
        return fresh;
    }

    private LolMatchPlayer toPlayerRow(String matchId, String puuid, String userId, JSONObject p) {
        JSONObject ch = p.getJSONObject("challenges");
        LolMatchPlayer row = new LolMatchPlayer();
        row.setMatchId(matchId);
        row.setPuuid(puuid);
        row.setUserId(userId);
        row.setChampionId(p.getInteger("championId"));
        row.setChampionName(p.getString("championName"));
        row.setTeamId(p.getInteger("teamId"));
        row.setTeamPosition(p.getString("teamPosition"));
        row.setWin(Boolean.TRUE.equals(p.getBoolean("win")) ? "1" : "0");
        row.setKills(intOf(p, "kills"));
        row.setDeaths(intOf(p, "deaths"));
        row.setAssists(intOf(p, "assists"));
        row.setGold(intOf(p, "goldEarned"));
        row.setDmgChamp(intOf(p, "totalDamageDealtToChampions"));
        row.setDmgTaken(intOf(p, "totalDamageTaken"));
        row.setVision(intOf(p, "visionScore"));
        // 补刀要把小兵和野怪加起来。只算 totalMinionsKilled 的话打野会显示成个位数
        row.setCs(intOf(p, "totalMinionsKilled") + intOf(p, "neutralMinionsKilled"));
        row.setChampLevel(intOf(p, "champLevel"));
        row.setTimePlayed(intOf(p, "timePlayed"));
        row.setKda(dec(ch, "kda", 2));
        row.setKillPart(dec(ch, "killParticipation", 4));
        row.setDmgShare(dec(ch, "teamDamagePercentage", 4));
        // 重开局：本人早投降 或 本队早投降，两个字段都要看——
        // 被队友带着重开的人自己那一项是 false
        boolean remake = Boolean.TRUE.equals(p.getBoolean("gameEndedInEarlySurrender"))
                || Boolean.TRUE.equals(p.getBoolean("teamEarlySurrendered"));
        row.setEarlySurr(remake ? "1" : "0");
        return row;
    }

    private void noteError(LolAccount a, RiotApiClient.RiotException e, SyncReport r) {
        String msg = e.getMessage();
        a.setLastError(msg.length() > 200 ? msg.substring(0, 200) : msg);
        accountMapper.updateById(a);
        r.errors.add(a.getGameName() + "#" + a.getTagLine() + " " + msg);
        if (e.isForbidden()) {
            // 这是最要命的一种：抓取会**静默停摆**，页面上只是「大家最近没打游戏」。
            // 而且它有两个完全不同的成因（key 过期 / 主机写错），所以主机名必须一起打出来
            log.error("LoL 抓取被拒绝，key 或主机有问题（主机 {}）：{}", e.getHost(), msg);
        } else {
            log.warn("LoL 抓取失败 {}#{}：{}", a.getGameName(), a.getTagLine(), msg);
        }
    }

    /** 把一场里的十个人登记进 lol_summoner，并把这场标记为已扫 */
    private void registerParticipants(String matchId, JSONObject info, JSONArray parts) {
        Long ts = info.getLong("gameStartTimestamp");
        Date seen = new Date(ts == null ? System.currentTimeMillis() : ts);
        String platform = StringUtils.defaultIfBlank(info.getString("platformId"), "oc1").toLowerCase();
        for (int i = 0; i < parts.size(); i++) {
            JSONObject p = parts.getJSONObject(i);
            String puuid = p.getString("puuid");
            if (StringUtils.isBlank(puuid)) {
                continue;
            }
            try {
                summonerMapper.upsert(puuid, p.getString("riotIdGameName"),
                        p.getString("riotIdTagline"), platform, seen);
            } catch (Exception e) {
                // 登记失败不该让整场入库失败——它只是给段位显示用的附加信息
                log.debug("LoL 登记召唤师失败 {}: {}", puuid, e.getMessage());
            }
        }
        matchMapper.markScanned(matchId);
    }

    /**
     * 补扫老对局的参与者名单。
     *
     * <p>这张表是后加的，之前入库的几百场没登记过里面的人。逐轮扫一批，
     * 靠 {@code SCANNED} 标记推进——**可中断、可重启**，不需要额外的进度记录。
     */
    private int scanOldMatches() {
        List<String> ids = matchMapper.unscanned(SCAN_PER_ROUND);
        int done = 0;
        for (String id : ids) {
            LolMatch m = matchMapper.selectById(id);
            String raw = m == null ? null : gunzip(m.getRawGz());
            if (raw == null) {
                // 没存原文的老数据永远扫不出来，标记掉免得每轮都重试
                matchMapper.markScanned(id);
                continue;
            }
            JSONObject info = JSON.parseObject(raw).getJSONObject("info");
            JSONArray parts = info == null ? null : info.getJSONArray("participants");
            if (parts == null) {
                matchMapper.markScanned(id);
                continue;
            }
            registerParticipants(id, info, parts);
            done++;
        }
        return done;
    }

    /**
     * 补一批路人的段位。
     *
     * <p>失败也要写 {@code RANK_UPDATED}——查不到段位（没打过排位）和查失败，
     * 对「要不要再查一次」是同一个答案：别在下一轮又来一次。
     * 不写的话这个人会永远排在待补队列最前面，把后面几千个堵死。
     */
    private int fillSummonerRanks(SyncReport r) {
        List<String> targets = summonerMapper.pendingRankTargets(RANK_FILL_PER_ROUND);
        int ok = 0;
        for (String puuid : targets) {
            LolSummoner su = summonerMapper.selectById(puuid);
            if (su == null) {
                continue;
            }
            try {
                JSONArray arr = riot.leagueEntries(
                        StringUtils.defaultIfBlank(su.getPlatform(), "oc1"), puuid);
                JSONObject solo = pickSolo(arr);
                su.setTier(solo == null ? null : solo.getString("tier"));
                su.setRankDiv(solo == null ? null : solo.getString("rank"));
                su.setLeaguePoint(solo == null ? null : solo.getInteger("leaguePoints"));
                ok++;
            } catch (RiotApiClient.RiotException e) {
                if (e.isForbidden()) {
                    // key 或主机的问题，这一轮别再往下打了
                    r.errors.add("段位补齐中止: " + e.getMessage());
                    log.error("LoL 补段位被拒绝（主机 {}）：{}", e.getHost(), e.getMessage());
                    break;
                }
                log.debug("LoL 补段位失败 {}: {}", puuid, e.getMessage());
            }
            su.setRankUpdated(new Date());
            summonerMapper.updateById(su);
        }
        return ok;
    }

    /** 取单双排那条；没有就退回第一条（灵活组排），都没有返回 null */
    private static JSONObject pickSolo(JSONArray arr) {
        for (int i = 0; arr != null && i < arr.size(); i++) {
            JSONObject e = arr.getJSONObject(i);
            if ("RANKED_SOLO_5x5".equals(e.getString("queueType"))) {
                return e;
            }
        }
        return arr != null && !arr.isEmpty() ? arr.getJSONObject(0) : null;
    }

    // ───────────────────────────────────────────── 单局详情

    /**
     * 一场对局的完整详情，**从库里的 RAW_GZ 解出来，不调 Riot**。
     *
     * <p>这是当初坚持存原始 JSON 的第三个回报（前两个是「加新指标不用重抓」和
     * 「晚绑定的人不用重拉」）：详情页要的是**十个人**的数据，而 {@code lol_match_player}
     * 按设计只存自己人。真去 Riot 补那五个路人的话，每打开一次详情就是一次 API 调用，
     * 二十个人随手点几下就能把 100 次/2 分钟的配额吃光。
     *
     * <p>返回的字段刻意给足：各种率（参团、伤害占比、承伤占比、伤害转化）、伤害构成、
     * 对线期数据、视野细分、目标参与、多杀。这些**全都躺在原文里、一分钱不多花**，
     * 前端要不要显示是另一回事——反过来「想看时才发现没存」是补不回来的。
     */
    public Map<String, Object> matchDetail(String matchId) {
        LolMatch m = matchMapper.selectById(matchId);
        if (m == null) {
            return null;
        }
        String raw = gunzip(m.getRawGz());
        if (raw == null) {
            return null;                             // 老数据没存原文，详情就给不出来
        }
        JSONObject info = JSON.parseObject(raw).getJSONObject("info");
        if (info == null) {
            return null;
        }

        // PUUID → 绑定记录。一次查全，避免在十个人的循环里逐个查库
        Map<String, LolAccount> acctByPuuid = new HashMap<>();
        Map<String, String> nickByPuuid = new HashMap<>();
        for (LolAccount a : accountMapper.selectList(null)) {
            acctByPuuid.put(a.getPuuid(), a);
            DreamUser u = userMapper.selectById(a.getUserId());
            nickByPuuid.put(a.getPuuid(), u == null ? a.getGameName() : u.getUserNickname());
        }
        // 路人的段位：一次把这十个人查出来，而不是在循环里逐个 selectById
        Map<String, LolSummoner> summByPuuid = new HashMap<>();
        JSONArray allParts = info.getJSONArray("participants");
        List<String> puuids = new ArrayList<>();
        for (int i = 0; allParts != null && i < allParts.size(); i++) {
            String pu = allParts.getJSONObject(i).getString("puuid");
            if (StringUtils.isNotBlank(pu)) {
                puuids.add(pu);
            }
        }
        if (!puuids.isEmpty()) {
            for (LolSummoner su : summonerMapper.selectBatchIds(puuids)) {
                summByPuuid.put(su.getPuuid(), su);
            }
        }

        Map<String, Object> out = new HashMap<>();
        out.put("matchId", matchId);
        out.put("queueId", m.getQueueId());
        out.put("gameStart", m.getGameStart());
        out.put("gameDuration", m.getGameDuration());
        out.put("gameVersion", m.getGameVersion());
        out.put("endResult", m.getEndResult());

        JSONArray parts = info.getJSONArray("participants");
        JSONArray teamArr = info.getJSONArray("teams");
        List<Map<String, Object>> teams = new ArrayList<>();
        for (int i = 0; teamArr != null && i < teamArr.size(); i++) {
            JSONObject t = teamArr.getJSONObject(i);
            Integer teamId = t.getInteger("teamId");
            Map<String, Object> team = new HashMap<>();
            team.put("teamId", teamId);
            team.put("win", Boolean.TRUE.equals(t.getBoolean("win")) ? "1" : "0");
            JSONObject obj = t.getJSONObject("objectives");
            Map<String, Object> objectives = new HashMap<>();
            for (String k : new String[]{"baron", "dragon", "tower", "inhibitor", "riftHerald", "champion"}) {
                JSONObject o = obj == null ? null : obj.getJSONObject(k);
                objectives.put(k, o == null ? 0 : intOf(o, "kills"));
            }
            team.put("objectives", objectives);

            int tk = 0, td = 0, ta = 0, tg = 0, tdmg = 0;
            List<Map<String, Object>> players = new ArrayList<>();
            for (int j = 0; parts != null && j < parts.size(); j++) {
                JSONObject p = parts.getJSONObject(j);
                if (!java.util.Objects.equals(p.getInteger("teamId"), teamId)) {
                    continue;
                }
                tk += intOf(p, "kills");
                td += intOf(p, "deaths");
                ta += intOf(p, "assists");
                tg += intOf(p, "goldEarned");
                tdmg += intOf(p, "totalDamageDealtToChampions");
                players.add(detailRow(p, nickByPuuid, acctByPuuid, summByPuuid));
            }
            team.put("kills", tk);
            team.put("deaths", td);
            team.put("assists", ta);
            team.put("gold", tg);
            team.put("dmgChamp", tdmg);
            team.put("players", players);
            teams.add(team);
        }
        out.put("teams", teams);
        return out;
    }

    /**
     * 详情里的一行。
     *
     * <p><b>各种「率」优先用 Riot 自己算好的</b>（{@code challenges} 里那一批）：
     * 参团率的分母是本队总击杀、伤害占比的分母是本队总输出，自己算要先把队伍聚合一遍，
     * 而且边界情况（0 击杀的队伍）要自己处理。用现成的既省事又和游戏内显示一致。
     *
     * <p>只有「伤害转化」是自己算的——每 1 金币打出多少对英雄伤害，Riot 没这个字段，
     * 但它是判断一个人「经济吃得值不值」的常用指标。
     */
    private Map<String, Object> detailRow(JSONObject p, Map<String, String> nickByPuuid,
                                          Map<String, LolAccount> acctByPuuid,
                                          Map<String, LolSummoner> summByPuuid) {
        JSONObject ch = p.getJSONObject("challenges");
        Map<String, Object> row = new HashMap<>();
        String puuid = p.getString("puuid");
        row.put("puuid", puuid);
        // riotIdGameName 在很老的对局里可能缺，退回 summonerName
        String gn = p.getString("riotIdGameName");
        row.put("riotId", StringUtils.isBlank(gn)
                ? StringUtils.defaultString(p.getString("summonerName"), "?")
                : gn + "#" + StringUtils.defaultString(p.getString("riotIdTagline")));
        row.put("nickname", nickByPuuid.get(puuid));   // null = 不是站内成员
        // 段位：成员优先用 lol_account（每小时刷，最新），路人用 lol_summoner（后台慢慢补）。
        // 两张表都按 PUUID 键，取哪张只影响新鲜度不影响正确性。
        // 注意这是**当前**段位，不是打这场时的——对局数据里没有段位字段，
        // league-v4 也只给当前值。界面上要写清楚，免得被当成历史战力
        LolAccount acct = acctByPuuid.get(puuid);
        LolSummoner summ = summByPuuid.get(puuid);
        String tier = acct != null && StringUtils.isNotBlank(acct.getTier())
                ? acct.getTier()
                : (summ == null ? null : summ.getTier());
        if (StringUtils.isNotBlank(tier)) {
            boolean fromAcct = acct != null && StringUtils.isNotBlank(acct.getTier());
            row.put("tier", tier);
            row.put("rankDiv", fromAcct ? acct.getRankDiv() : summ.getRankDiv());
            row.put("leaguePoint", fromAcct ? acct.getLeaguePoint() : summ.getLeaguePoint());
        } else if (summ == null || summ.getRankUpdated() == null) {
            // 还没查过 ≠ 没段位。分开告诉前端，才能显示「查询中」而不是「未定级」——
            // 后台补完几千个人要十几个小时，这期间显示错的比显示"还没查"更糟
            row.put("rankPending", "1");
        }

        row.put("championName", p.getString("championName"));
        row.put("championId", p.getInteger("championId"));
        row.put("champLevel", intOf(p, "champLevel"));
        row.put("teamPosition", p.getString("teamPosition"));
        row.put("spell1", intOf(p, "summoner1Id"));
        row.put("spell2", intOf(p, "summoner2Id"));
        List<Integer> items = new ArrayList<>();
        for (int k = 0; k <= 6; k++) {
            items.add(intOf(p, "item" + k));
        }
        row.put("items", items);

        row.put("kills", intOf(p, "kills"));
        row.put("deaths", intOf(p, "deaths"));
        row.put("assists", intOf(p, "assists"));
        row.put("cs", intOf(p, "totalMinionsKilled") + intOf(p, "neutralMinionsKilled"));
        row.put("gold", intOf(p, "goldEarned"));
        row.put("dmgChamp", intOf(p, "totalDamageDealtToChampions"));
        row.put("dmgTaken", intOf(p, "totalDamageTaken"));
        row.put("vision", intOf(p, "visionScore"));
        row.put("timePlayed", intOf(p, "timePlayed"));
        row.put("deadTime", intOf(p, "totalTimeSpentDead"));

        // 伤害构成
        row.put("dmgPhysical", intOf(p, "physicalDamageDealtToChampions"));
        row.put("dmgMagic", intOf(p, "magicDamageDealtToChampions"));
        row.put("dmgTrue", intOf(p, "trueDamageDealtToChampions"));
        row.put("dmgObjective", intOf(p, "damageDealtToObjectives"));
        row.put("dmgTurret", intOf(p, "damageDealtToTurrets"));

        // 各种率（Riot 算好的）
        row.put("kda", dbl(ch, "kda"));
        row.put("killPart", dbl(ch, "killParticipation"));
        row.put("dmgShare", dbl(ch, "teamDamagePercentage"));
        row.put("takenShare", dbl(ch, "damageTakenOnTeamPercentage"));
        row.put("dpm", dbl(ch, "damagePerMinute"));
        row.put("gpm", dbl(ch, "goldPerMinute"));
        row.put("vpm", dbl(ch, "visionScorePerMinute"));
        // 伤害转化：每 1 金币打出多少对英雄伤害。Riot 没这个字段，但它最能说明
        // 「这些经济吃得值不值」——同样 12k 经济，打出 25k 和打出 8k 是两回事
        int gold = intOf(p, "goldEarned");
        row.put("dmgPerGold", gold > 0
                ? Math.round(intOf(p, "totalDamageDealtToChampions") * 1000.0 / gold) / 1000.0
                : null);

        // 战斗
        row.put("doubleKills", intOf(p, "doubleKills"));
        row.put("tripleKills", intOf(p, "tripleKills"));
        row.put("quadraKills", intOf(p, "quadraKills"));
        row.put("pentaKills", intOf(p, "pentaKills"));
        row.put("killingSpree", intOf(p, "largestKillingSpree"));
        row.put("firstBlood", Boolean.TRUE.equals(p.getBoolean("firstBloodKill")) ? "1" : "0");
        row.put("soloKills", intOf2(ch, "soloKills"));
        row.put("immobilizations", intOf2(ch, "enemyChampionImmobilizations"));

        // 对线期
        row.put("cs10", intOf2(ch, "laneMinionsFirst10Minutes"));
        row.put("levelLead", intOf2(ch, "maxLevelLeadLaneOpponent"));

        // 视野细分
        row.put("wardsPlaced", intOf(p, "wardsPlaced"));
        row.put("wardsKilled", intOf(p, "wardsKilled"));
        row.put("controlWards", intOf(p, "detectorWardsPlaced"));

        // 目标参与
        row.put("turretTakedowns", intOf(p, "turretTakedowns"));
        row.put("dragonTakedowns", intOf2(ch, "dragonTakedowns"));
        row.put("baronTakedowns", intOf2(ch, "baronTakedowns"));
        row.put("turretPlates", intOf2(ch, "turretPlatesTaken"));

        // 辅助向
        row.put("healTeam", intOf(p, "totalHealsOnTeammates"));
        row.put("shieldTeam", intOf(p, "totalDamageShieldedOnTeammates"));
        return row;
    }

    // ───────────────────────────────────────────── 小工具

    /** challenges 里的整数。这个子对象在极老的对局里可能整个不存在 */
    private static int intOf2(JSONObject o, String k) {
        return o == null ? 0 : intOf(o, k);
    }

    /** challenges 里的小数。缺就给 null，让前端显示「—」而不是一个假的 0 */
    private static Double dbl(JSONObject o, String k) {
        if (o == null) {
            return null;
        }
        java.math.BigDecimal v = o.getBigDecimal(k);
        return v == null ? null : Math.round(v.doubleValue() * 10000.0) / 10000.0;
    }

    private static int intOf(JSONObject o, String k) {
        Integer v = o.getInteger(k);
        return v == null ? 0 : v;
    }

    private static BigDecimal dec(JSONObject o, String k, int scale) {
        if (o == null) {
            return null;
        }
        java.math.BigDecimal v = o.getBigDecimal(k);
        return v == null ? null : v.setScale(scale, RoundingMode.HALF_UP);
    }

    static byte[] gzip(String s) {
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream();
             GZIPOutputStream gz = new GZIPOutputStream(bos)) {
            gz.write(s.getBytes(StandardCharsets.UTF_8));
            gz.finish();
            return bos.toByteArray();
        } catch (IOException e) {
            return null;                             // 存不下原文不该让整场入库失败
        }
    }

    static String gunzip(byte[] b) {
        if (b == null || b.length == 0) {
            return null;
        }
        try (GZIPInputStream gz = new GZIPInputStream(new ByteArrayInputStream(b));
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int n;
            while ((n = gz.read(chunk)) > 0) {
                bos.write(chunk, 0, n);
            }
            return bos.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            return null;
        }
    }

    /** 一轮同步的结果。给手动触发的接口用，也给日志用 */
    public static class SyncReport {
        public int backfilled;
        /** 这一轮补完了几个账号。backfilled 数的是对局数，重绑时那个会是 0（全命中已有数据） */
        public int backfilledAccounts;
        /** 这一轮补扫了几场老对局的参与者名单 */
        public int scanned;
        /** 这一轮补了几个人的段位 */
        public int ranksFilled;
        /** 还有多少人没查过段位 */
        public int ranksPending;
        public int polled;
        public String skipped;
        public List<String> errors = new ArrayList<>();

        public int getBackfilled() {
            return backfilled;
        }

        public int getBackfilledAccounts() {
            return backfilledAccounts;
        }

        public int getScanned() {
            return scanned;
        }

        public int getRanksFilled() {
            return ranksFilled;
        }

        public int getRanksPending() {
            return ranksPending;
        }

        public int getPolled() {
            return polled;
        }

        public String getSkipped() {
            return skipped;
        }

        public List<String> getErrors() {
            return errors;
        }
    }
}
