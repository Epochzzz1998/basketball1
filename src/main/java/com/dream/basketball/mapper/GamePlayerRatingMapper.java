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
 * <p>两条都按**一场**取全，而不是按球员一个个查：一场最多二十几个人，
 * 一次查回来是一趟数据库往返；逐个查是二十几趟，而它们必定同时被需要
 * （打分页一打开就要显示所有人的平均分）。
 */
public interface GamePlayerRatingMapper extends BaseMapper<GamePlayerRating> {

    /**
     * 这场里每个被评过的球员的平均分和**打分人数**。
     *
     * <p>{@code count(SCORE)} 而不是 {@code count(*)}：加了短评之后，
     * 「只留一句话没打分」的行也在这张表里，而 {@code avg()} 会跳过它们。
     * 用 {@code count(*)} 的话分子跳过了分母没跳过，页面上会出现
     * 「2 人打分，平均 5.0」而实际只有一个人给了 5——分母是错的。
     */
    @Select("select PLAYER_ID playerId, round(avg(SCORE), 1) avgScore, count(SCORE) n "
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
            + "from game_player_rating where GAME_ID = #{gameId} and SCORE is not null "
            + "group by PLAYER_ID, SCORE order by PLAYER_ID, SCORE")
    List<Map<String, Object>> histogram(@Param("gameId") String gameId);

    /**
     * 这场里所有球员短评，按球员分组由调用方来做。
     *
     * <p>只回有话说的——只打了分没写字的人不该在短评列表里占一行空白，
     * 他们的分已经算进平均分了，那才是他们表达的东西。
     *
     * <p>带上 {@code ratingId}：回复要挂在具体某一条短评底下，前端得知道那条的 id。
     */
    @Select("select r.RATING_ID ratingId, r.PLAYER_ID playerId, r.SCORE score, "
            + "       r.COMMENT_TXT commentTxt, ifnull(r.UPDATE_TIME, r.CREATE_TIME) postTime, "
            + "       r.USER_ID userId, u.USER_NICKNAME nickname, u.AVATAR avatar "
            + "from game_player_rating r left join dream_user u on u.USER_ID = r.USER_ID "
            + "where r.GAME_ID = #{gameId} and r.COMMENT_TXT is not null and r.COMMENT_TXT <> '' "
            + "order by ifnull(r.UPDATE_TIME, r.CREATE_TIME) desc")
    List<Map<String, Object>> comments(@Param("gameId") String gameId);

    /** 我在这场里给过分的球员，连同我写的短评。用来把打分控件和输入框回填成上次的值 */
    @Select("select PLAYER_ID playerId, SCORE score, COMMENT_TXT commentTxt "
            + "from game_player_rating where GAME_ID = #{gameId} and USER_ID = #{userId}")
    List<Map<String, Object>> mine(@Param("gameId") String gameId, @Param("userId") String userId);
}
