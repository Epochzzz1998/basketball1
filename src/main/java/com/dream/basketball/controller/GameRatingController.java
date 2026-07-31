package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.GameComment;
import com.dream.basketball.entity.GamePlayerRating;
import com.dream.basketball.entity.GameRating;
import com.dream.basketball.entity.GameRatingReply;
import com.dream.basketball.mapper.GameCommentMapper;
import com.dream.basketball.mapper.GamePlayerRatingMapper;
import com.dream.basketball.mapper.GameRatingMapper;
import com.dream.basketball.mapper.GameRatingReplyMapper;
import com.dream.basketball.mapper.PlayerMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.MentionUtil;
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
 * <h2>分和短评是**两套不同的规则**，所以是两组接口</h2>
 *
 * <table>
 *   <tr><th></th><th>评分（rateGame / ratePlayer）</th><th>短评（comment）</th></tr>
 *   <tr><td>一个人能有几条</td><td>一条</td><td>想发几条发几条</td></tr>
 *   <tr><td>能不能改</td><td>能，再打一次覆盖</td><td><b>不能</b>，只能删</td></tr>
 * </table>
 *
 * <p>「再打一次是改」不只是防刷——「看完第二天改主意」是很正常的事，
 * 而一个人对同一场比赛只该有一个分，允许叠加的话平均分就成了「谁点得多谁说了算」。
 *
 * <p>短评正相反：它是**说过的话**，说过就定了。早先两者挤在同一行，
 * 等于把「一个人只有一个」顺带加在了短评上，于是补一句话变成了改写前一句。
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

    /**
     * 这一场是 NBA 比赛还是一局 LoL。
     *
     * <p><b>三张表原样复用</b>（{@code game_rating} / {@code game_comment} /
     * {@code game_rating_reply}）：它们只按一个 GAME_ID 键，没有任何 NBA 专属列，
     * 而两边的 id 天然不会撞——B-R 的是 {@code 202604180CLE}，Riot 的是
     * {@code OC1_654943407}。为一套一模一样的「打分 + 短评 + 回复」再建三张表、
     * 再抄一遍控制器，换来的只是重复。
     *
     * <p>只有三处真的要分流：这一场存不存在（查哪张表）、要不要带球员维度
     * （LoL 不按人打分）、以及 @ 通知点了跳哪儿。其余一个字都不用改。
     */
    private static final String KIND_LOL = "lol";

    /** 这一场存在吗。顺带承担「kind 和 id 对不对得上」的校验 */
    private boolean gameExists(String id, String kind) {
        return KIND_LOL.equals(kind)
                ? lolMatchMapper.selectById(id) != null
                : !playerMapper.findGameMeta(id).isEmpty();
    }

    @Autowired
    private GameRatingMapper gameRatingMapper;
    @Autowired
    private GamePlayerRatingMapper playerRatingMapper;
    @Autowired
    private GameCommentMapper commentMapper;
    @Autowired
    private GameRatingReplyMapper replyMapper;
    @Autowired
    private PlayerMapper playerMapper;
    @Autowired
    private com.dream.basketball.mapper.LolMatchMapper lolMatchMapper;
    @Autowired
    private com.dream.basketball.service.LolSyncService lolSync;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private UserInformationService userInformationService;

    /**
     * 一场比赛的全部评分数据。公开可读；登录了额外带上「我给过的分」。
     *
     * <p>球员平均分回的是 {@code playerId -> {avgScore, n}} 的映射而不是数组——
     * 前端拿到之后要按 box score 的顺序逐行贴上去，映射可以直接取，
     * 数组还得先自己建一次索引。
     */
    @GetMapping("/detail")
    public Object detail(String gameId, String kind, String userInformationId, HttpServletRequest request) {
        String id = StringUtils.trimToEmpty(gameId);
        if (id.isEmpty()) {
            return new Result<>(1, "缺少比赛 id", null);
        }
        // 从「我的消息」点 @ 通知进来时带 userInformationId，顺便把那条标记已读
        // （和专题页、帖子详情同一套做法：读接口顺手做，不额外开一个"标已读"接口）
        if (StringUtils.isNotBlank(userInformationId)) {
            userInformationService.updateInformationRead(userInformationId);
        }
        Map<String, Object> data = new HashMap<>();
        data.put("game", gameRatingMapper.gameSummary(id));
        data.put("histogram", gameRatingMapper.scoreHistogram(id));
        // 按人聚合的这几块两边共用：NBA 的 PLAYER_ID 是 nba-6606，LoL 的是那一场的 PUUID。
        // 这几张表只按 (GAME_ID, PLAYER_ID) 键，对它们来说两者没有区别
        Map<String, Object> byPlayer = new HashMap<>();
        for (Map<String, Object> row : playerRatingMapper.aggregates(id)) {
            byPlayer.put(String.valueOf(row.get("playerId")), row);
        }
        data.put("players", byPlayer);
        data.put("playerHist", groupBy(playerRatingMapper.histogram(id), "playerId"));
        // 短评一次取全（比赛的 + 所有球员的），在这里按 PLAYER_ID 分好组。
        // 分组放在后端而不是让前端自己建索引：前端要按 box score 的顺序逐行取，
        // 映射直接取得到，数组还得先扫一遍。空串那一组是评比赛本身的
        List<Map<String, Object>> allComments = commentMapper.byGame(id);
        List<Map<String, Object>> allReplies = replyMapper.byGame(id);
        // @ 到的人可能已经改过昵称：正文里留的是旧名（定位要用），这里补一个 cur=当前昵称，
        // 前端显示时优先用它。不补的话，改名之后 @ 出来的还是那个已经不存在的名字
        enrichMentions(allComments, allReplies);
        Map<String, List<Map<String, Object>>> byTarget =
                groupBy(allComments, "playerId");
        data.put("comments", byTarget.getOrDefault("", java.util.Collections.emptyList()));
        byTarget.remove("");
        data.put("playerComments", byTarget);
        // 回复按被回复的短评分组。比赛短评和球员短评的回复在同一张表里，
        // 一次取回来分好组，两边各取各的
        data.put("replies", groupBy(allReplies, "targetId"));

        // 没登录时 me 是 null，下面两块就都不带——前端据此显示「登录后可评分」
        String me = SecUtil.getLoginUserIdToSession(request);
        if (StringUtils.isNotBlank(me)) {
            data.put("mine", gameRatingMapper.selectOne(new QueryWrapper<GameRating>()
                    .eq("GAME_ID", id).eq("USER_ID", me).last("limit 1")));
            // 只回分数。短评不用回填——它是**追加式**的，输入框永远是空的，
            // 回填反而会让人以为再发一次是在改上一条
            Map<String, Object> minePlayers = new HashMap<>();
            for (Map<String, Object> row : playerRatingMapper.mine(id, me)) {
                minePlayers.put(String.valueOf(row.get("playerId")), row.get("score"));
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
     * 给这场比赛打分。**只管分，不带短评**。
     *
     * <p>{@code score} 传 0 或不传 = 撤销我的分。分是一人一条、可以改的，
     * 短评是另一回事（多条、不可改），走 {@code /comment}。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/rateGame")
    public Object rateGame(String gameId, String kind, Integer score, HttpServletRequest request) {
        String id = StringUtils.trimToEmpty(gameId);
        String me = SecUtil.getLoginUserIdToSession(request);
        if (id.isEmpty()) {
            return new Result<>(1, "缺少比赛 id", null);
        }
        if (score != null && score != 0 && (score < MIN_SCORE || score > MAX_SCORE)) {
            return new Result<>(1, "评分要在 " + MIN_SCORE + " 到 " + MAX_SCORE + " 之间", null);
        }
        // 比赛得真的存在。不查的话这张表会被任意字符串撑起来，
        // 而外键在这个库里没用（历史数据是脚本灌的，加外键会让灌数据变慢很多）
        if (!gameExists(id, kind)) {
            return new Result<>(1, "没有这场比赛", null);
        }
        GameRating exist = gameRatingMapper.selectOne(new QueryWrapper<GameRating>()
                .eq("GAME_ID", id).eq("USER_ID", me).last("limit 1"));
        if (score == null || score == 0) {
            // 撤分**不动短评**。这是拆表之后的直接好处：以前两者同一行，
            // 撤分就得琢磨「他的话要不要一起删」，现在这个问题不存在了
            if (exist != null) {
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
            r.setCreateTime(new Date());
            gameRatingMapper.insert(r);
        } else {
            exist.setScore(score);
            exist.setUpdateTime(new Date());
            gameRatingMapper.updateById(exist);
        }
        return new Result<>(0, "已评分", null);
    }

    /**
     * 给这场里的某个球员打分。同 {@link #rateGame}：只管分，0 或不传 = 撤销。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/ratePlayer")
    public Object ratePlayer(String gameId, String kind, String playerId, Integer score,
                             HttpServletRequest request) {
        String id = StringUtils.trimToEmpty(gameId);
        String pid = StringUtils.trimToEmpty(playerId);
        String me = SecUtil.getLoginUserIdToSession(request);
        if (id.isEmpty() || pid.isEmpty()) {
            return new Result<>(1, "缺少比赛或球员", null);
        }
        if (score != null && score != 0 && (score < MIN_SCORE || score > MAX_SCORE)) {
            return new Result<>(1, "评分要在 " + MIN_SCORE + " 到 " + MAX_SCORE + " 之间", null);
        }
        GamePlayerRating exist = playerRatingMapper.selectOne(new QueryWrapper<GamePlayerRating>()
                .eq("GAME_ID", id).eq("PLAYER_ID", pid).eq("USER_ID", me).last("limit 1"));
        if (score == null || score == 0) {
            if (exist != null) {
                playerRatingMapper.deleteById(exist.getRatingId());
            }
            return new Result<>(0, "已取消", null);
        }
        if (exist == null) {
            if (!onRoster(id, pid, kind)) {
                return new Result<>(1, "这场比赛的名单里没有这个球员", null);
            }
            GamePlayerRating r = new GamePlayerRating();
            r.setRatingId(UUID.randomUUID().toString());
            r.setGameId(id);
            r.setPlayerId(pid);
            r.setUserId(me);
            r.setScore(score);
            r.setCreateTime(new Date());
            playerRatingMapper.insert(r);
        } else {
            exist.setScore(score);
            exist.setUpdateTime(new Date());
            playerRatingMapper.updateById(exist);
        }
        return new Result<>(0, "已评分", null);
    }

    /**
     * 发一条短评。{@code playerId} 为空 = 评这场比赛本身。
     *
     * <p><b>只有发，没有改。</b>想补充就再发一条——「看到一半骂一句、看完再夸一句」
     * 是两句话，不是一句话改了两遍。这条规则由表结构本身保证
     * （{@code game_comment} 没有唯一键、没有 UPDATE_TIME），不靠这里的判断守。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/comment")
    public Object comment(String gameId, String kind, String playerId, String content,
                          HttpServletRequest request) {
        String id = StringUtils.trimToEmpty(gameId);
        String pid = StringUtils.trimToEmpty(playerId);
        String text = StringUtils.trimToNull(content);
        String me = SecUtil.getLoginUserIdToSession(request);
        if (id.isEmpty()) {
            return new Result<>(1, "缺少比赛 id", null);
        }
        if (text == null) {
            return new Result<>(1, "说点什么再发", null);
        }
        if (text.length() > MAX_COMMENT) {
            text = text.substring(0, MAX_COMMENT);
        }
        if (!gameExists(id, kind)) {
            return new Result<>(1, "没有这场比赛", null);
        }
        if (!pid.isEmpty() && !onRoster(id, pid, kind)) {
            return new Result<>(1, "这场比赛的名单里没有这个球员", null);
        }
        GameComment c = new GameComment();
        c.setCommentId(UUID.randomUUID().toString());
        c.setGameId(id);
        c.setPlayerId(pid);          // 空串 = 评比赛本身
        c.setUserId(me);
        c.setContent(text);
        c.setMentions(MentionUtil.resolveTextMentions(text, allNickToId()));
        c.setCreateTime(new Date());
        commentMapper.insert(c);
        notifyMentions(c.getMentions(), me, id, text, kind);
        return new Result<>(0, "已发布", null);
    }

    /**
     * 删掉自己的短评，连同它底下的回复。
     *
     * <p>「不能改」和「不能删」是两回事：改会让别人已经回复过的话悄悄变成另一句，
     * 删不会——回复跟着一起消失，不会留下答非所问的残句。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/deleteComment")
    public Object deleteComment(String commentId, HttpServletRequest request) {
        String me = SecUtil.getLoginUserIdToSession(request);
        GameComment c = commentMapper.selectById(StringUtils.trimToEmpty(commentId));
        if (c == null) {
            return new Result<>(0, "已删除", null);      // 已经没了，当成功
        }
        if (!StringUtils.equals(c.getUserId(), me)) {
            return new Result<>(1, "只能删自己的短评", null);
        }
        // TARGET_ID 上没有外键，数据库不会替我们清；留着就是一堆指向不存在内容的孤儿
        replyMapper.delete(new QueryWrapper<GameRatingReply>()
                .eq("TARGET_ID", c.getCommentId()));
        commentMapper.deleteById(c.getCommentId());
        return new Result<>(0, "已删除", null);
    }

    /**
     * 回复一条短评。
     *
     * <p>{@code targetId} 是那条短评的 {@code COMMENT_ID}。比赛短评和球员短评
     * 在同一张表里，所以一个接口够用。
     *
     * <p>{@code replyToUser} 是「回复楼中楼里的某个人」时才给。给了也只当显示用，
     * 结构上仍然只有两层。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/reply")
    public Object reply(String gameId, String kind, String targetId, String content, String replyToUser,
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
        if (commentMapper.selectCount(new QueryWrapper<GameComment>()
                .eq("COMMENT_ID", target).eq("GAME_ID", id)) == 0) {
            return new Result<>(1, "这条短评不存在了", null);
        }
        GameRatingReply r = new GameRatingReply();
        r.setReplyId(UUID.randomUUID().toString());
        r.setGameId(id);
        r.setTargetId(target);
        r.setUserId(me);
        r.setReplyToUser(StringUtils.trimToNull(replyToUser));
        r.setContent(text);
        r.setMentions(MentionUtil.resolveTextMentions(text, allNickToId()));
        r.setCreateTime(new Date());
        replyMapper.insert(r);
        notifyMentions(r.getMentions(), me, id, text, kind);
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

    /**
     * 这个人在不在当场大名单里——**出场的和没出场的都算**。
     *
     * <p>只认出场名单的话，「今天该上的人怎么没上」这种意见就没地方表达了，
     * 而那恰恰是赛后最常见的一句话。但名单之外的 id 一律拒绝，
     * 否则这几张表会被任意字符串撑起来。
     *
     * <p>打分和发短评都要问同一个问题，所以抽出来——两份实现迟早会有一份忘了
     * 把未出场的人算进去。
     */

    /**
     * 全站「昵称 → userId」。
     *
     * <p><b>@ 到谁是后端算的，不是前端报的。</b>前端那个联想面板只列「有来往的人」
     * （关注我的 ∪ 我关注的），它做的事情仅仅是把 {@code @昵称 } 插进文本里——
     * 和自己一个字一个字打出来完全等价。所以陌生人只要昵称打对照样 @ 得到，
     * 只是没有提示。这条规则要成立，解析就必须在这里按**全站**昵称做。
     *
     * <p>用户量在几百这个量级，每次现查两列比维护一份缓存划算：缓存要处理改名失效，
     * 而改名恰恰是这个映射唯一会变的时候。
     */
    /**
     * 给短评/回复行里的 {@code mentions} 补一个 {@code cur}＝该 id 当前的昵称。
     *
     * <p>被 @ 的人改了昵称之后，正文里那串字还是旧的（前端要靠它在文本里定位），
     * 但显示出来必须是新名字——否则点进去会看到一个和链接文字对不上的人。
     *
     * <p>先把整页涉及的 id 收齐再查一次，不逐行查：一场几十条短评加回复，
     * 逐行查就是几十趟往返，而它们要的是同一张表的同几行。
     */
    private void enrichMentions(List<Map<String, Object>> comments, List<Map<String, Object>> replies) {
        java.util.Set<String> ids = new java.util.LinkedHashSet<>();
        List<Map<String, Object>> all = new ArrayList<>();
        all.addAll(comments);
        all.addAll(replies);
        for (Map<String, Object> row : all) {
            ids.addAll(MentionUtil.parseCommentMentionIds((String) row.get("mentions")));
        }
        if (ids.isEmpty()) {
            return;
        }
        Map<String, String> idToNick = new HashMap<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>()
                .select("USER_ID", "USER_NICKNAME").in("USER_ID", ids))) {
            if (u != null) {
                idToNick.put(u.getUserId(), u.getUserNickname());
            }
        }
        for (Map<String, Object> row : all) {
            String m = (String) row.get("mentions");
            if (StringUtils.isNotBlank(m)) {
                row.put("mentions", MentionUtil.enrichCommentMentions(m, idToNick));
            }
        }
    }

    private Map<String, String> allNickToId() {
        Map<String, String> m = new HashMap<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>()
                .select("USER_ID", "USER_NICKNAME"))) {
            if (u != null && StringUtils.isNotBlank(u.getUserNickname())) {
                m.put(u.getUserNickname(), u.getUserId());
            }
        }
        return m;
    }

    /**
     * 给被 @ 到的人各发一条站内消息（排除自己——@ 自己不该给自己发通知）。
     *
     * <p>{@code msgId} 存的是 <b>gameId</b>：点这条消息要跳回那场比赛
     * （前端 {@code utils/notification.js} 据此拼 {@code /games/:gameId}）。
     * 存短评 id 是没用的——短评没有自己的页面。
     */
    private void notifyMentions(String mentionsJson, String meId, String gameId, String text, String kind) {
        java.util.Set<String> ids = MentionUtil.parseCommentMentionIds(mentionsJson);
        if (ids.isEmpty()) {
            return;
        }
        DreamUser me = userMapper.selectById(meId);
        String myName = me == null ? "" : me.getUserNickname();
        for (String uid : ids) {
            if (StringUtils.equals(uid, meId)) {
                continue;
            }
            userInformationService.saveUserInformation(meId, myName, uid,
                    KIND_LOL.equals(kind) ? Constants.MENTION_LOL : Constants.MENTION_GAME,
                    gameId, "", "", "", text, "");
        }
    }

    private boolean onRoster(String gameId, String playerId, String kind) {
        if (KIND_LOL.equals(kind)) {
            // 一局十个人，**路人和对面也能评**——这正是这个功能被要的样子。
            // 只有站内成员的那一两行在 lol_match_player 里，另外九个人只在 RAW_GZ 里，
            // 所以校验必须从原始对局数据走（见 LolSyncService.matchParticipants）
            return lolSync.matchParticipants(gameId).contains(playerId);
        }
        return playerMapper.findGameBoxScore(gameId).stream()
                .anyMatch(r -> playerId.equals(String.valueOf(r.get("playerId"))))
                || playerMapper.findGameAbsences(gameId).stream()
                .anyMatch(r -> playerId.equals(String.valueOf(r.get("playerId"))));
    }
}
