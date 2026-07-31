package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.GameComment;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 短评的查询。
 *
 * <p>一次把整场的短评取回来（比赛的和所有球员的），由调用方按 {@code PLAYER_ID} 分组。
 * 不按球员逐条查：一场里球员短评加比赛短评可能有几十条，逐条查就是几十趟往返，
 * 而它们必定同时被需要——页面一打开每个球员那一栏都要显示自己的短评数。
 */
public interface GameCommentMapper extends BaseMapper<GameComment> {

    /**
     * 这场比赛下的全部短评，新的在前。
     *
     * <p>{@code playerId} 为空串的是评比赛本身的。
     *
     * <p>顺带把作者当前的分数带出来（{@code myScore}）——短评旁边显示「他给了几分」
     * 很有用，但那个分是**可以改的**，所以只能现查，不能在发短评时抄一份存下来：
     * 存快照的话，一个人改了分之后，同一个人的两条短评会显示两个不同的分。
     */
    @Select("select c.COMMENT_ID commentId, c.PLAYER_ID playerId, c.CONTENT content, "
            + "       c.CREATE_TIME createTime, c.MENTIONS mentions, "
            + "       c.USER_ID userId, u.USER_NICKNAME nickname, u.AVATAR avatar, "
            + "       case when c.PLAYER_ID = '' then gr.SCORE else pr.SCORE end myScore "
            + "from game_comment c "
            + "left join dream_user u on u.USER_ID = c.USER_ID "
            + "left join game_rating gr on gr.GAME_ID = c.GAME_ID and gr.USER_ID = c.USER_ID "
            + "left join game_player_rating pr on pr.GAME_ID = c.GAME_ID "
            + "     and pr.PLAYER_ID = c.PLAYER_ID and pr.USER_ID = c.USER_ID "
            + "where c.GAME_ID = #{gameId} "
            + "order by c.CREATE_TIME desc")
    List<Map<String, Object>> byGame(@Param("gameId") String gameId);

    /**
     * 一个人在赛后评分区说过的话，给个人主页的「评论」足迹用。
     *
     * <p>{@code playerName} 只有评球员的那些行有值，评比赛本身的是 null——
     * 前端据此决定显示成「评了这场」还是「评了某某」。
     *
     * <p>比赛本身的信息（日期、两队、比分）**不在这里查**：那要对
     * {@code player_game_stats} 做一次 group by，而这条已经在 join 三张表了。
     * 调用方拿到几个 gameId 之后再补，见 {@code UserProfileController}。
     */
    @Select("select c.COMMENT_ID commentId, c.GAME_ID gameId, c.PLAYER_ID playerId, "
            + "       c.CONTENT content, c.CREATE_TIME createTime, "
            + "       coalesce(p.PLAYER_NAME, p.NAME_EN) playerName, "
            + "       case when c.PLAYER_ID = '' then gr.SCORE else pr.SCORE end myScore "
            + "from game_comment c "
            + "left join dream_player p on p.PLAYER_ID = c.PLAYER_ID "
            + "left join game_rating gr on gr.GAME_ID = c.GAME_ID and gr.USER_ID = c.USER_ID "
            + "left join game_player_rating pr on pr.GAME_ID = c.GAME_ID "
            + "     and pr.PLAYER_ID = c.PLAYER_ID and pr.USER_ID = c.USER_ID "
            + "where c.USER_ID = #{userId} "
            + "order by c.CREATE_TIME desc limit #{limit}")
    List<Map<String, Object>> byUser(@Param("userId") String userId, @Param("limit") int limit);

    /** 这个人一共说过几条。列表是截断的，统计不能跟着截断 */
    @Select("select count(*) from game_comment where USER_ID = #{userId}")
    int countByUser(@Param("userId") String userId);
}
