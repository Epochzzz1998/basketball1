package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.GameRatingReply;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 短评回复的查询。
 *
 * <p>按**一场比赛**一次全取，不按短评逐条查：一场里球员短评加比赛短评可能有几十条，
 * 逐条查就是几十趟数据库往返，而它们必定同时被需要——页面一打开每条短评底下
 * 都要显示回复。取回来之后在 Java 里按 {@code targetId} 分组。
 */
public interface GameRatingReplyMapper extends BaseMapper<GameRatingReply> {

    /**
     * 这场比赛下面所有短评的回复，按时间正序（先说的在上面，读起来是一段对话）。
     *
     * <p>{@code replyToName} 用第二次 join 取回来。存的是 USER_ID 而不是当时的昵称，
     * 所以改了昵称之后历史回复里的「回复 @某某」也会跟着变成新名字——
     * 存昵称快照的话，改名之后那句话就指向一个已经不存在的人了。
     */
    @Select("select r.REPLY_ID replyId, r.TARGET_ID targetId, r.CONTENT content, "
            + "       r.CREATE_TIME createTime, "
            + "       r.USER_ID userId, u.USER_NICKNAME nickname, u.AVATAR avatar, "
            + "       r.REPLY_TO_USER replyToUser, t.USER_NICKNAME replyToName "
            + "from game_rating_reply r "
            + "left join dream_user u on u.USER_ID = r.USER_ID "
            + "left join dream_user t on t.USER_ID = r.REPLY_TO_USER "
            + "where r.GAME_ID = #{gameId} "
            + "order by r.CREATE_TIME")
    List<Map<String, Object>> byGame(@Param("gameId") String gameId);
}
