package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.GameRating;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 比赛评分的查询。
 *
 * <h2>平均分只统计真打了分的人</h2>
 *
 * {@code SCORE} 允许为空（只写短评不打分），而 {@code avg()} 和 {@code count(列)}
 * 在 SQL 里本来就跳过 NULL——所以这里用 {@code count(SCORE)} 而不是 {@code count(*)}：
 * 后者会把「只留了一句话」的人算进人数，平均分的分母和分子就对不上了。
 */
public interface GameRatingMapper extends BaseMapper<GameRating> {

    /** 这场比赛的平均分和打分人数。没人评过时 avg 为 null，由调用方翻译成「还没人评」 */
    @Select("select round(avg(SCORE), 1) avgScore, count(SCORE) scored, count(*) total "
            + "from game_rating where GAME_ID = #{gameId}")
    Map<String, Object> gameSummary(@Param("gameId") String gameId);

    /**
     * 这场比赛下的短评列表。
     *
     * <p>只回有话说的（{@code COMMENT_TXT} 非空）——只打了分没写字的人不该在列表里
     * 占一行空白。他们的分已经算进平均分了，那才是他们表达的东西。
     *
     * <p>按 {@code UPDATE_TIME} 优先排序：改过分的人重新冒头，看的人才知道有人改了主意。
     */
    @Select("select r.RATING_ID ratingId, r.USER_ID userId, u.USER_NICKNAME nickname, u.AVATAR avatar, "
            + "       r.SCORE score, r.COMMENT_TXT commentTxt, "
            + "       ifnull(r.UPDATE_TIME, r.CREATE_TIME) postTime "
            + "from game_rating r left join dream_user u on u.USER_ID = r.USER_ID "
            + "where r.GAME_ID = #{gameId} and r.COMMENT_TXT is not null and r.COMMENT_TXT <> '' "
            + "order by ifnull(r.UPDATE_TIME, r.CREATE_TIME) desc limit 100")
    List<Map<String, Object>> comments(@Param("gameId") String gameId);

    /**
     * 分数分布：1..10 各有几个人。前端画一条小柱状图。
     *
     * <p>比单看平均分有用得多——7.5 分可能是「大家都觉得还行」，
     * 也可能是「一半人给 10 一半人给 5」，那是两场完全不同的比赛。
     */
    @Select("select SCORE score, count(*) n from game_rating "
            + "where GAME_ID = #{gameId} and SCORE is not null group by SCORE order by SCORE")
    List<Map<String, Object>> scoreHistogram(@Param("gameId") String gameId);
}
