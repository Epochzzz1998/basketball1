package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.LolAccount;
import com.dream.basketball.mapper.LolAccountMapper;
import com.dream.basketball.mapper.LolMatchPlayerMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.service.LolSyncService;
import com.dream.basketball.service.RiotApiClient;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 开黑战绩模块的接口。
 *
 * <h2>为什么所有查询都不碰 Riot</h2>
 *
 * 这里没有一个接口会去调 Riot——数据全部预先抓好躺在库里，页面查询走的是本地 SQL。
 * 这不是优化，是这个模块能成立的**前提**：Riot 的个人 key 限额是 100 次/2 分钟，
 * 要是每次翻页都现场去拉，五个人同时点一下就把全站配额打满了。
 *
 * <p>唯一会调 Riot 的是 {@code /bind}（把 Riot ID 换成 PUUID），而那是一个人一辈子一次。
 */
@RestController
@RequestMapping("/lol")
public class LolController {

    /** 默认统计窗口。30 天既够攒出样本，又不至于把三个月前的手感算进今天的榜 */
    private static final int DEFAULT_DAYS = 30;
    /** 上榜的最低场次。低于它的人不显示，而不是显示一个 100% 胜率 */
    private static final int DEFAULT_MIN_GAMES = 5;

    @Autowired
    private LolSyncService sync;
    @Autowired
    private LolAccountMapper accountMapper;
    @Autowired
    private LolMatchPlayerMapper playerMapper;
    @Autowired
    private UserMapper userMapper;

    // ───────────────────────────────────────────── 绑定

    /** 我绑了哪些号 */
    @RequiresRole(Role.USER)
    @GetMapping("/accounts")
    public Object accounts(HttpServletRequest request) {
        String me = SecUtil.getLoginUserIdToSession(request);
        return new Result<>(0, "成功", accountMapper.selectList(
                new QueryWrapper<LolAccount>().eq("USER_ID", me).orderByAsc("BIND_TIME")));
    }

    /**
     * 绑定一个 Riot ID。前端传的是完整的 {@code 名字#后缀}，这里拆开。
     *
     * <p>Riot 的 404 要翻译成人话：用户看到的应该是「这个 Riot ID 查不到」，
     * 而不是一句 HTTP 状态。这是整个模块里用户唯一会直接撞上 Riot 报错的地方。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/bind")
    public Object bind(String riotId, String platform, String region, HttpServletRequest request) {
        String me = SecUtil.getLoginUserIdToSession(request);
        if (StringUtils.isBlank(riotId) || !riotId.contains("#")) {
            return new Result<>(1, "请填写完整的 Riot ID，形如 Epoch#3113", null);
        }
        String gameName = StringUtils.substringBeforeLast(riotId, "#").trim();
        String tagLine = StringUtils.substringAfterLast(riotId, "#").trim();
        if (StringUtils.isAnyBlank(gameName, tagLine)) {
            return new Result<>(1, "请填写完整的 Riot ID，形如 Epoch#3113", null);
        }
        try {
            return new Result<>(0, "绑定成功，正在拉取历史战绩",
                    sync.bind(me, gameName, tagLine, platform, region));
        } catch (RiotApiClient.RiotException e) {
            if (e.isNotFound()) {
                return new Result<>(1, "查不到这个 Riot ID，检查一下大小写和 # 后面的数字", null);
            }
            if (e.isForbidden()) {
                return new Result<>(1, "暂时连不上 Riot（密钥或线路问题），稍后再试", null);
            }
            return new Result<>(1, "Riot 那边没响应，稍后再试", null);
        } catch (IllegalStateException e) {
            return new Result<>(1, e.getMessage(), null);
        }
    }

    @RequiresRole(Role.USER)
    @PostMapping("/unbind")
    public Object unbind(String accountId, HttpServletRequest request) {
        sync.unbind(SecUtil.getLoginUserIdToSession(request), accountId);
        return new Result<>(0, "已解绑", null);
    }

    // ───────────────────────────────────────────── 查询

    /**
     * 战绩流：把扁平行按对局合并成「一场里有谁」。
     *
     * <p>合并放在 Java 而不是 SQL：一场里各人的英雄、KDA、位置都要分别展示，
     * 在 SQL 里拼成字符串再拆回来只是把解析工作换个地方做。
     *
     * @param date   指定某一天（yyyy-MM-dd）。给了就忽略 days——「看这一天」和
     *               「看最近 N 天」是两种意图，同时生效只会互相削
     * @param player 站内昵称或游戏 ID，模糊匹配，任一命中即可
     */
    @RequiresRole(Role.USER)
    @GetMapping("/feed")
    public Object feed(Integer days, String date, Integer queueId, String player) {
        Date since;
        Date until;
        if (StringUtils.isNotBlank(date)) {
            Calendar c = dayStart(date);
            if (c == null) {
                return new Result<>(1, "日期格式不对，要 yyyy-MM-dd", null);
            }
            since = c.getTime();
            c.add(Calendar.DAY_OF_YEAR, 1);
            until = c.getTime();
        } else {
            since = since(days);
            until = FAR_FUTURE;
        }
        List<Map<String, Object>> rows = playerMapper.feed(
                since, until, q(queueId), StringUtils.defaultString(player).trim());
        Map<String, Map<String, Object>> byMatch = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String id = String.valueOf(row.get("matchId"));
            Map<String, Object> m = byMatch.get(id);
            if (m == null) {
                m = new HashMap<>();
                m.put("matchId", id);
                m.put("queueId", row.get("queueId"));
                m.put("gameStart", row.get("gameStart"));
                m.put("gameDuration", row.get("gameDuration"));
                m.put("endResult", row.get("endResult"));
                m.put("players", new ArrayList<Map<String, Object>>());
                byMatch.put(id, m);
            }
            Map<String, Object> p = new HashMap<>(row);
            // 对局级的字段已经提到外层了，留在每个人身上是重复
            p.remove("matchId");
            p.remove("queueId");
            p.remove("gameStart");
            p.remove("gameDuration");
            p.remove("endResult");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> ps = (List<Map<String, Object>>) m.get("players");
            ps.add(p);
        }
        return new Result<>(0, "成功", new ArrayList<>(byMatch.values()));
    }

    /**
     * 某个月里哪几天有对局，给日历标注用。
     *
     * <p>按**显示中的月份**取，而不是按选中日期所在的月——两者不是一回事，
     * 在日历里翻月并不会改变选中日期。NBA 的每日赛场早先就是按选中日期取的，
     * 结果翻到别的月份一片空白，点了某一天才突然冒出标注。
     */
    @RequiresRole(Role.USER)
    @GetMapping("/dates")
    public Object dates(String month) {
        Calendar c = dayStart(StringUtils.defaultString(month) + "-01");
        if (c == null) {
            return new Result<>(1, "月份格式不对，要 yyyy-MM", null);
        }
        Date from = c.getTime();
        c.add(Calendar.MONTH, 1);
        return new Result<>(0, "成功", playerMapper.matchDates(from, c.getTime()));
    }

    /** 搜索框的候选：站内昵称 + 已绑定的游戏 ID */
    @RequiresRole(Role.USER)
    @GetMapping("/searchOptions")
    public Object searchOptions() {
        return new Result<>(0, "成功", playerMapper.searchOptions());
    }

    /**
     * 个人榜。
     *
     * <p>{@code minGames} 允许调，但**默认不为 0**：门槛是这个榜可信的前提，
     * 而不是一个可有可无的过滤器。想看全部的人可以自己传 1。
     */
    @RequiresRole(Role.USER)
    @GetMapping("/board")
    public Object board(Integer days, Integer queueId, Integer minGames) {
        // 榜单现在按**游戏账号**聚合，每行自带段位——不用再去查「这个人最高的号是哪个」，
        // 那一步（bestRanks）是按人聚合时代的产物，现在多余了
        List<Map<String, Object>> rows = playerMapper.leaderboard(since(days), q(queueId), min(minGames));
        Map<String, Object> data = new HashMap<>();
        data.put("rows", rows);
        data.put("summary", playerMapper.summary(since(days)));
        data.put("minGames", min(minGames));
        return new Result<>(0, "成功", data);
    }

    /** 开黑组合榜：谁和谁一起打得最多、一起赢得最多 */
    @RequiresRole(Role.USER)
    @GetMapping("/duo")
    public Object duo(Integer days, Integer queueId, Integer minGames) {
        return new Result<>(0, "成功",
                playerMapper.duoBoard(since(days), q(queueId), min(minGames)));
    }

    /**
     * 一场对局的完整详情（十个人，含路人）。
     *
     * <p>单独一个接口而不是塞进战绩流：战绩流一次返回三十场，每场再挂十个人的完整数据
     * 会让那个响应大出一个数量级，而绝大多数场次用户根本不会点开。按需取。
     *
     * <p>和其它查询一样**不碰 Riot**——十个人的数据是从库里的原始 JSON 解出来的。
     */
    @RequiresRole(Role.USER)
    @GetMapping("/match")
    public Object match(String matchId) {
        if (StringUtils.isBlank(matchId)) {
            return new Result<>(1, "缺少对局 id", null);
        }
        Map<String, Object> d = sync.matchDetail(matchId);
        if (d == null) {
            return new Result<>(1, "这场对局的详细数据没有存下来", null);
        }
        return new Result<>(0, "成功", d);
    }

    /**
     * 一个人的资料卡：汇总、英雄池、位置分布、常一起打的队友、绑定的账号与段位。
     *
     * <p>一次请求把这几块一起给：它们都是同一个人同一个时间窗的数据，
     * 拆成四个接口只会让页面上出现四个各自转圈的方块。
     *
     * <p><b>不带最低场次门槛</b>——门槛是为了「别让 1 场 100% 的人霸榜」，
     * 而这里是点进来看具体某个人的，只打过两把也该如实显示。
     *
     * @param puuids 逗号分隔，只统计这几个绑定账号；空串 = 全部。
     *               有小号的人在资料卡上可以勾选，「大号什么水平」和「所有号加起来」
     *               是两个不同的问题，都得答得出来
     * @param positions 逗号分隔的位置（TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY/OTHER），只筛
     *               **英雄池和战绩**；空串 = 全部。汇总、位置分布、队友这三块**不跟着筛**：
     *               位置分布本身就是那排开关，跟着筛的话点一次就再也点不回来；
     *               汇总留作基准——「他中路的胜率」要和「他整体的胜率」摆在一起才有意义
     */
    @RequiresRole(Role.USER)
    @GetMapping("/player")
    public Object player(String userId, Integer days, String puuids, String positions) {
        if (StringUtils.isBlank(userId)) {
            return new Result<>(1, "缺少用户", null);
        }
        Date from = since(days);
        // 空串 = 看这个人的全部号。前端至少会勾一个，但接口这一层不该假设它一定守规矩
        String pu = StringUtils.defaultString(puuids).trim();
        String pos = StringUtils.defaultString(positions).trim();
        Map<String, Object> data = new HashMap<>();
        data.put("summary", playerMapper.playerSummary(userId, from, pu));
        data.put("champions", playerMapper.championPool(userId, from, pu, pos));
        data.put("positions", playerMapper.positionMix(userId, from, pu));
        data.put("mates", playerMapper.mates(userId, from, pu));
        data.put("matches", playerMapper.playerMatches(userId, from, pu, pos));
        // 绑定的号（含段位）。一个人可能有小号，段位按各号分别显示——合并没有意义。
        // 顺带附上每个号最后一次打的时间：资料卡要靠它决定默认勾哪个号
        List<LolAccount> accts = accountMapper.selectList(
                new QueryWrapper<LolAccount>().eq("USER_ID", userId).orderByAsc("BIND_TIME"));
        Map<String, Object> lastPlayed = new HashMap<>();
        for (Map<String, Object> r : playerMapper.lastPlayedByAccount(userId)) {
            lastPlayed.put(String.valueOf(r.get("puuid")), r.get("lastPlayed"));
        }
        List<Map<String, Object>> acctOut = new ArrayList<>();
        for (LolAccount a : accts) {
            Map<String, Object> m = new HashMap<>();
            m.put("accountId", a.getAccountId());
            m.put("puuid", a.getPuuid());
            m.put("gameName", a.getGameName());
            m.put("tagLine", a.getTagLine());
            m.put("tier", a.getTier());
            m.put("rankDiv", a.getRankDiv());
            m.put("leaguePoint", a.getLeaguePoint());
            m.put("lastPlayed", lastPlayed.get(a.getPuuid()));
            acctOut.add(m);
        }
        data.put("accounts", acctOut);
        DreamUser u = userMapper.selectById(userId);
        if (u != null) {
            Map<String, Object> who = new HashMap<>();
            who.put("userId", u.getUserId());
            who.put("nickname", u.getUserNickname());
            who.put("avatar", u.getAvatar());
            data.put("user", who);
        }
        return new Result<>(0, "成功", data);
    }

    /**
     * 手动跑一轮同步。
     *
     * <p>留这个接口是因为定时任务的周期是分钟级，而**验证一次改动**不该等那么久。
     * 限超管：它会真的去打 Riot 的接口，谁都能点等于把配额开放给所有人。
     */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/sync")
    public Object syncNow() {
        return new Result<>(0, "成功", sync.runOnce());
    }

    // ───────────────────────────────────────────── 参数兜底

    /** 「不设上界」用一个远期时间表示，好让 SQL 永远是同一个区间形状 */
    private static final Date FAR_FUTURE = new Date(4102444800000L);   // 2100-01-01

    /** yyyy-MM-dd → 当天零点。格式不对返回 null，由调用方翻译成人话 */
    private static Calendar dayStart(String date) {
        java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("yyyy-MM-dd");
        f.setLenient(false);
        try {
            Calendar c = Calendar.getInstance();
            c.setTime(f.parse(date));
            return c;
        } catch (java.text.ParseException e) {
            return null;
        }
    }

    private static Date since(Integer days) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, -(days == null || days <= 0 ? DEFAULT_DAYS : days));
        return c.getTime();
    }

    /** 0 = 全部队列，见 LolMatchPlayerMapper 的说明 */
    private static int q(Integer queueId) {
        return queueId == null || queueId < 0 ? 0 : queueId;
    }

    private static int min(Integer minGames) {
        return minGames == null || minGames < 1 ? DEFAULT_MIN_GAMES : minGames;
    }
}
