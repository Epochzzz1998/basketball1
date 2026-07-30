package com.dream.basketball.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.entity.LolAccount;
import com.dream.basketball.entity.LolMatch;
import com.dream.basketball.entity.LolMatchPlayer;
import com.dream.basketball.mapper.LolAccountMapper;
import com.dream.basketball.mapper.LolMatchMapper;
import com.dream.basketball.mapper.LolMatchPlayerMapper;
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

    @Autowired
    private RiotApiClient riot;
    @Autowired
    private LolAccountMapper accountMapper;
    @Autowired
    private LolMatchMapper matchMapper;
    @Autowired
    private LolMatchPlayerMapper playerMapper;

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
     * 跑一轮：先把没回填过的账号补历史，再对所有账号看最近几场。
     *
     * <p>回填放在轮询前面，而且**一轮只补一个账号**：回填是几百次请求、十几分钟的事，
     * 一次补完所有人会让新对局十几分钟内都进不来。分摊到每一轮，
     * 既不会饿死常规轮询，20 个人也就二十来轮补完。
     */
    public SyncReport runOnce() {
        SyncReport r = new SyncReport();
        if (!riot.isConfigured()) {
            r.skipped = "RIOT_API_KEY 没配置";
            return r;
        }
        List<LolAccount> accounts = accountMapper.selectList(
                new QueryWrapper<LolAccount>().eq("ENABLED", "1"));
        if (accounts.isEmpty()) {
            return r;
        }
        Set<String> bound = new HashSet<>();
        Map<String, String> puuidToUser = new HashMap<>();
        for (LolAccount a : accounts) {
            bound.add(a.getPuuid());
            puuidToUser.put(a.getPuuid(), a.getUserId());
        }

        for (LolAccount a : accounts) {
            if (!"1".equals(a.getBackfilled())) {
                r.backfilled += syncAccount(a, bound, puuidToUser, BACKFILL_SIZE, r);
                a.setBackfilled("1");
                accountMapper.updateById(a);
                return r;                            // 这一轮只补一个人，把时间还给常规轮询
            }
        }
        for (LolAccount a : accounts) {
            r.polled += syncAccount(a, bound, puuidToUser, POLL_SIZE, r);
        }
        return r;
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

    // ───────────────────────────────────────────── 小工具

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
        public int polled;
        public String skipped;
        public List<String> errors = new ArrayList<>();

        public int getBackfilled() {
            return backfilled;
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
