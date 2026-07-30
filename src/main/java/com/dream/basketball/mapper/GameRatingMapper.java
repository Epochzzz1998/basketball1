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
 * <p>这张表现在只存分（短评搬去了 {@code game_comment}），{@code SCORE} 是 NOT NULL，
 * 所以行数就是打分人数，{@code count(*)} 是对的。
 * 早先短评还在这张表里的时候不是这样——那时「只留一句话没打分」的行也在，
 * 而 {@code avg()} 会跳过它们、{@code count(*)} 不会，分子分母口径对不上，
 * 页面上会出现「2 人打分，平均 5.0」而实际只有一个人给了 5。
 */
public interface GameRatingMapper extends BaseMapper<GameRating> {

    /** 这场比赛的平均分和打分人数。没人评过时 avg 为 null，由调用方翻译成「还没人评」 */
    @Select("select round(avg(SCORE), 1) avgScore, count(*) scored "
            + "from game_rating where GAME_ID = #{gameId}")
    Map<String, Object> gameSummary(@Param("gameId") String gameId);

    /**
     * 分数分布：1..5 各有几个人。前端画一条小柱状图。
     *
     * <p>比单看平均分有用得多——3 分可能是「大家都觉得平庸」，
     * 也可能是「一半人给 5 一半人给 1」，那是两场完全不同的比赛。
     */
    @Select("select SCORE score, count(*) n from game_rating "
            + "where GAME_ID = #{gameId} group by SCORE order by SCORE")
    List<Map<String, Object>> scoreHistogram(@Param("gameId") String gameId);
}
