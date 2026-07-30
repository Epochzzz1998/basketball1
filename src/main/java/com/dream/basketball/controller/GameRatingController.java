package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.GamePlayerRating;
import com.dream.basketball.entity.GameRating;
import com.dream.basketball.entity.GameRatingReply;
import com.dream.basketball.mapper.GamePlayerRatingMapper;
import com.dream.basketball.mapper.GameRatingMapper;
import com.dream.basketball.mapper.GameRatingReplyMapper;
import com.dream.basketball.mapper.PlayerMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 赛后评分：给一场比赛打分写短评，给场上的球员逐个打分。
 *
 * <h2>为什么和比赛数据分成两个接口</h2>
 *
 * 比赛详情（{@code /player/gameDetail}）是**不会变的历史数据**，评分是**每分钟都在变的**。
 * 合成一个接口的话，要么每次刷新 box score 都顺带把评分重查一遍，
 * 要么打完一个分就得把整场数据重新拉一次。分开之后，打分只刷新评分那一块。
 *
 * <h2>读是公开的，写要登录</h2>
 *
 * 平均分和短评谁都能看——这是这个页面的内容本身。但**读接口也认登录状态**：
 * 登录了就顺带回「我给过多少分」，好把控件回填成上次的选择。
 * 用 {@code getLoginUserIdToSession} 而不是 {@code @RequiresRole}，
 * 没登录时它返回 null，正好是「我还没评过」。
 *
 * <h2>再评一次是改，不是叠加</h2>
 *
 * 两张表的唯一键都带 USER_ID，重复提交走的是 update。这不只是防刷——
 * 「看完第二天改主意」是很正常的事，而一个人对同一场比赛只该有一个态度。
 */
@RestController
@RequestMapping("/gameRating")
public class GameRatingController {

    /**
     * 打分区间 1..5。
     *
     * <p>原来是 1..10，改小了。理由是**分布画不出来**：十档在几十个人的样本下
     * 永远是一片稀疏毛刺，而这一页的重点恰恰是「大家看法一不一致」——
     * 五根柱子才看得出是齐刷刷还是两极。顺带解决了手机上十个小方块太挤的问题，
     * 而且实际也没人分得清 7 分和 8 分的差别。
     */
    private static final int MIN_SCORE = 1;
    private static final int MAX_SCORE = 5;
    /** 短评长度上限，和建表时的 varchar(300) 对齐 */
    private static final int MAX_COMMENT = 300;

    @Autowired
    private GameRatingMapper gameRatingMapper;
    @Autowired
    private GamePlayerRatingMapper playerRatingMapper;
    @Autowired
    private GameRatingReplyMapper replyMapper;
    @Autowired
    private PlayerMapper playerMapper;

    /**
     * 一场比赛的全部评分数据。公开可读；登录了额外带上「我给过的分」。
     *
     * <p>球员平均分回的是 {@code playerId -> {avgScore, n}} 的映射而不是数组——
     * 前端拿到之后要按 box score 的顺序逐行贴上去，映射可以直接取，
     * 数组还得先自己建一次索引。
     */
    @GetMapping("/detail")
    public Object detail(String gameId, HttpServletRequest request) {
        String id = StringUtils.trimToEmpty(gameId);
        if (id.isEmpty()) {
            return new Result<>(1, "缺少比赛 id", null);
        }
        Map<String, Object> data = new HashMap<>();
        data.put("game", gameRatingMapper.gameSummary(id));
        data.put("histogram", gameRatingMapper.scoreHistogram(id));
        data.put("comments", gameRatingMapper.comments(id));

        Map<String, Object> byPlayer = new HashMap<>();
        for (Map<String, Object> row : playerRatingMapper.aggregates(id)) {
            byPlayer.put(String.valueOf(row.get("playerId")), row);
        }
        data.put("players", byPlayer);
        // 每个球员的分数分布，和比赛那条同样的形状：playerId -> [{score, n}]
        data.put("playerHist", groupBy(playerRatingMapper.histogram(id), "playerId"));
        // 球员短评，按球员分组。分组放在这里而不是让前端自己建索引：
        // 前端要按 box score 的顺序逐行取，映射直接取得到，数组还得先扫一遍
        data.put("playerComments", groupBy(playerRatingMapper.comments(id), "playerId"));
        // 回复按被回复的短评分组。比赛短评和球员短评的回复在同一张表里，
        // 一次取回来分好组，两边各取各的
        data.put("replies", groupBy(replyMapper.byGame(id), "targetId"));

        // 没登录时 me 是 null，下面两块就都不带——前端据此显示「登录后可评分」
        String me = SecUtil.getLoginUserIdToSession(request);
        if (StringUtils.isNotBlank(me)) {
            data.put("mine", gameRatingMapper.selectOne(new QueryWrapper<GameRating>()
                    .eq("GAME_ID", id).eq("USER_ID", me).last("limit 1")));
            // 回的是整行而不是只回分数：现在还有短评要回填到输入框里
            Map<String, Object> minePlayers = new HashMap<>();
            for (Map<String, Object> row : playerRatingMapper.mine(id, me)) {
                minePlayers.put(String.valueOf(row.get("playerId")), row);
            }
            data.put("minePlayers", minePlayers);
            data.put("meId", me);
        }
        return new Result<>(0, "成功", data);
    }

    /** 按某一列把扁平行分组。三处要用同一个动作，写三遍迟早有一处漏掉 null 键 */
    private static Map<String, List<Map<String, Object>>> groupBy(
            List<Map<String, Object>> rows, String key) {
        Map<String, List<Map<String, Object>>> out = new HashMap<>();
        for (Map<String, Object> row : rows) {
            out.computeIfAbsent(String.valueOf(row.get(key)), k -> new ArrayList<>()).add(row);
        }
        return out;
    }

    /**
     * 给这场比赛打分 / 写短评。两者都可以单独给。
     *
     * <p>分和短评**都空**时删掉这条记录——那是「我不想评了」，
     * 留一条什么都没有的空记录只会让打分人数虚高。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/rateGame")
    public Object rateGame(String gameId, Integer score, String comment, HttpServletRequest request) {
        String id = StringUtils.trimToEmpty(gameId);
        String me = SecUtil.getLoginUserIdToSession(request);
        if (id.isEmpty()) {
            return new Result<>(1, "缺少比赛 id", null);
        }
        if (score != null && (score < MIN_SCORE || score > MAX_SCORE)) {
            return new Result<>(1, "评分要在 " + MIN_SCORE + " 到 " + MAX_SCORE + " 之间", null);
        }
        // 比赛得真的存在。不查的话这张表会被任意字符串撑起来，
        // 而外键在这个库里没用（历史数据是脚本灌的，加外键会让灌数据变慢很多）
        if (playerMapper.findGameMeta(id).isEmpty()) {
            return new Result<>(1, "没有这场比赛", null);
        }
        String text = StringUtils.trimToNull(comment);
        if (text != null && text.length() > MAX_COMMENT) {
            text = text.substring(0, MAX_COMMENT);
        }

        GameRating exist = gameRatingMapper.selectOne(new QueryWrapper<GameRating>()
                .eq("GAME_ID", id).eq("USER_ID", me).last("limit 1"));
        if (score == null && text == null) {
            if (exist != null) {
                // 同 ratePlayer：连带删掉底下的回复，否则它们变成指向不存在内容的孤儿
                replyMapper.delete(new QueryWrapper<GameRatingReply>()
                        .eq("TARGET_ID", exist.getRatingId()));
                gameRatingMapper.deleteById(exist.getRatingId());
            }
            return new Result<>(0, "已取消评分", null);
        }
        if (exist == null) {
            GameRating r = new GameRating();
            r.setRatingId(UUID.randomUUID().toString());
            r.setGameId(id);
            r.setUserId(me);
            r.setScore(score);
            r.setCommentTxt(text);
            r.setCreateTime(new Date());
            gameRatingMapper.insert(r);
        } else {
            // 必须用 UpdateWrapper 逐列 set：MyBatis-Plus 的 updateById 是按实体字段
            // **非 null 才写**，而「只留短评、把分数清掉」恰恰要把 SCORE 写成 null——
            // 走 updateById 的话那次点击会静悄悄不生效，界面显示已清空、刷新后分数又回来
            gameRatingMapper.update(null, new UpdateWrapper<GameRating>()
                    .eq("RATING_ID", exist.getRatingId())
                    .set("SCORE", score)
                    .set("COMMENT_TXT", text)
                    .set("UPDATE_TIME", new Date()));
        }
        return new Result<>(0, "已评分", null);
    }

    /**
     * 给这场里的某个球员打分，可带一条短评。
     *
     * <p>{@code score} 传 0 表示撤销打分。**但如果同时留着短评，这一行不会被删掉**——
     * 「我不给分了但话还想说」和「我不评了」是两回事，只有分和短评都空才删。
     * 这和比赛那一栏是同一套规则。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/ratePlayer")
    public Object ratePlayer(String gameId, String playerId, Integer score, String comment,
                             HttpServletRequest request) {
        String id = StringUtils.trimToEmpty(gameId);
        String pid = StringUtils.trimToEmpty(playerId);
        String me = SecUtil.getLoginUserIdToSession(request);
        if (id.isEmpty() || pid.isEmpty()) {
            return new Result<>(1, "缺少比赛或球员", null);
        }
        if (score == null || score < 0 || score > MAX_SCORE) {
            return new Result<>(1, "评分要在 " + MIN_SCORE + " 到 " + MAX_SCORE + " 之间", null);
        }
        String text = StringUtils.trimToNull(comment);
        if (text != null && text.length() > MAX_COMMENT) {
            text = text.substring(0, MAX_COMMENT);
        }
        GamePlayerRating exist = playerRatingMapper.selectOne(new QueryWrapper<GamePlayerRating>()
                .eq("GAME_ID", id).eq("PLAYER_ID", pid).eq("USER_ID", me).last("limit 1"));
        if (score == 0 && text == null) {
            if (exist != null) {
                // 连带删掉挂在这条短评底下的回复。留着的话它们就成了指向不存在内容的孤儿，
                // 而 TARGET_ID 上没有外键，数据库不会替我们做这件事
                replyMapper.delete(new QueryWrapper<GameRatingReply>()
                        .eq("TARGET_ID", exist.getRatingId()));
                playerRatingMapper.deleteById(exist.getRatingId());
            }
            return new Result<>(0, "已取消", null);
        }
        if (exist != null) {
            // 同 rateGame：必须逐列 set，updateById 会跳过 null，
            // 于是「取消打分只留短评」那一次点击会静悄悄不生效
            playerRatingMapper.update(null, new UpdateWrapper<GamePlayerRating>()
                    .eq("RATING_ID", exist.getRatingId())
                    .set("SCORE", score == 0 ? null : score)
                    .set("COMMENT_TXT", text)
                    .set("UPDATE_TIME", new Date()));
            return new Result<>(0, "已评分", null);
        }
        {
            // 这个人得真的在当场大名单里——**出场的和没出场的都算**。
            // 只认出场名单的话，「今天该上的人怎么没上」这种意见就没地方表达了，
            // 而那恰恰是赛后最常见的一句话。但名单之外的人一律拒绝，
            // 否则这张表会被任意 playerId 撑起来
            if (playerMapper.findGameBoxScore(id).stream()
                    .noneMatch(r -> pid.equals(String.valueOf(r.get("playerId"))))
                    && playerMapper.findGameAbsences(id).stream()
                    .noneMatch(r -> pid.equals(String.valueOf(r.get("playerId"))))) {
                return new Result<>(1, "这场比赛的名单里没有这个球员", null);
            }
            GamePlayerRating r = new GamePlayerRating();
            r.setRatingId(UUID.randomUUID().toString());
            r.setGameId(id);
            r.setPlayerId(pid);
            r.setUserId(me);
            r.setScore(score == 0 ? null : score);
            r.setCommentTxt(text);
            r.setCreateTime(new Date());
            playerRatingMapper.insert(r);
        }
        return new Result<>(0, "已评分", null);
    }

    /**
     * 回复一条短评（比赛的或球员的都走这条）。
     *
     * <p>{@code targetId} 是被回复那条短评的 {@code RATING_ID}。两张评分表的主键都是 UUID，
     * 所以一个接口够用——见 {@link GameRatingReply} 的说明。
     *
     * <p>{@code replyToUser} 是「回复楼中楼里的某个人」时才给。给了也只当显示用，
     * 结构上仍然只有两层。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/reply")
    public Object reply(String gameId, String targetId, String content, String replyToUser,
                        HttpServletRequest request) {
        String id = StringUtils.trimToEmpty(gameId);
        String target = StringUtils.trimToEmpty(targetId);
        String text = StringUtils.trimToNull(content);
        String me = SecUtil.getLoginUserIdToSession(request);
        if (id.isEmpty() || target.isEmpty()) {
            return new Result<>(1, "缺少比赛或短评", null);
        }
        if (text == null) {
            return new Result<>(1, "回复不能为空", null);
        }
        if (text.length() > MAX_COMMENT) {
            text = text.substring(0, MAX_COMMENT);
        }
        // 被回复的那条短评得真的存在，而且**得属于这场比赛**。
        // 不校验 GAME_ID 的话，可以拿别的比赛的短评 id 往这里挂回复，
        // 那条回复会出现在一个和它无关的页面上（因为列表是按 GAME_ID 取的）
        boolean ok = gameRatingMapper.selectCount(new QueryWrapper<GameRating>()
                .eq("RATING_ID", target).eq("GAME_ID", id)) > 0
                || playerRatingMapper.selectCount(new QueryWrapper<GamePlayerRating>()
                .eq("RATING_ID", target).eq("GAME_ID", id)) > 0;
        if (!ok) {
            return new Result<>(1, "这条短评不存在了", null);
        }
        GameRatingReply r = new GameRatingReply();
        r.setReplyId(UUID.randomUUID().toString());
        r.setGameId(id);
        r.setTargetId(target);
        r.setUserId(me);
        r.setReplyToUser(StringUtils.trimToNull(replyToUser));
        r.setContent(text);
        r.setCreateTime(new Date());
        replyMapper.insert(r);
        return new Result<>(0, "已回复", null);
    }

    /** 删掉自己的回复。别人的一律拒绝——这里没有版主概念，短评区不需要 */
    @RequiresRole(Role.USER)
    @PostMapping("/deleteReply")
    public Object deleteReply(String replyId, HttpServletRequest request) {
        String me = SecUtil.getLoginUserIdToSession(request);
        GameRatingReply r = replyMapper.selectById(StringUtils.trimToEmpty(replyId));
        if (r == null) {
            return new Result<>(0, "已删除", null);   // 已经没了，当成功
        }
        if (!StringUtils.equals(r.getUserId(), me)) {
            return new Result<>(1, "只能删自己的回复", null);
        }
        replyMapper.deleteById(r.getReplyId());
        return new Result<>(0, "已删除", null);
    }
}
