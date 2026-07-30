package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.LolAccount;
import com.dream.basketball.mapper.LolAccountMapper;
import com.dream.basketball.mapper.LolMatchPlayerMapper;
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
     */
    @RequiresRole(Role.USER)
    @GetMapping("/feed")
    public Object feed(Integer days) {
        List<Map<String, Object>> rows = playerMapper.feed(since(days));
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
     * 个人榜。
     *
     * <p>{@code minGames} 允许调，但**默认不为 0**：门槛是这个榜可信的前提，
     * 而不是一个可有可无的过滤器。想看全部的人可以自己传 1。
     */
    @RequiresRole(Role.USER)
    @GetMapping("/board")
    public Object board(Integer days, Integer queueId, Integer minGames) {
        Map<String, Object> data = new HashMap<>();
        data.put("rows", playerMapper.leaderboard(since(days), q(queueId), min(minGames)));
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
