package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.GamePlayerRating;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 球员打分的查询。
 *
 * <p>三条都按**一场**取全，而不是按球员一个个查：一场最多二十几个人，
 * 一次查回来是一趟数据库往返；逐个查是二十几趟，而它们必定同时被需要
 * （打分页一打开就要显示所有人的平均分）。
 */
public interface GamePlayerRatingMapper extends BaseMapper<GamePlayerRating> {

    /** 这场里每个被评过的球员的平均分和打分人数。SCORE 是 NOT NULL，所以 count(*) 就是人数 */
    @Select("select PLAYER_ID playerId, round(avg(SCORE), 1) avgScore, count(*) n "
            + "from game_player_rating where GAME_ID = #{gameId} group by PLAYER_ID")
    List<Map<String, Object>> aggregates(@Param("gameId") String gameId);

    /**
     * 每个球员的分数分布：{@code (球员, 分数) -> 人数}。
     *
     * <p>和平均分分开一条查询，是因为它们的粒度不同——平均分一个球员一行，
     * 分布一个球员最多五行。硬塞进一条要么变成五个 {@code sum(case when ...)} 的宽表，
     * 要么在 Java 里再拆一遍。分两条各自都是最直白的写法，代价是一趟多余的往返，
     * 而这两条都走同一个 {@code GAME_ID} 索引，量级是几十行。
     */
    @Select("select PLAYER_ID playerId, SCORE score, count(*) n "
            + "from game_player_rating where GAME_ID = #{gameId} "
            + "group by PLAYER_ID, SCORE order by PLAYER_ID, SCORE")
    List<Map<String, Object>> histogram(@Param("gameId") String gameId);

    /** 我在这场里给过分的球员。用来把打分控件回填成我上次给的值 */
    @Select("select PLAYER_ID playerId, SCORE score "
            + "from game_player_rating where GAME_ID = #{gameId} and USER_ID = #{userId}")
    List<Map<String, Object>> mine(@Param("gameId") String gameId, @Param("userId") String userId);
}
