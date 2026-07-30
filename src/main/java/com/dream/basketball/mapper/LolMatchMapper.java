package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.LolMatch;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

public interface LolMatchMapper extends BaseMapper<LolMatch> {

    /**
     * 还没登记过参与者名单的对局。
     *
     * <p>`lol_summoner` 是后加的，之前入库的几百场没登记过里面的人。
     * 靠这个标记逐轮补扫——**可中断可重启**，不需要额外记进度。
     *
     * <p>按时间倒序：最近的对局里的人才是有人会去看的，先扫它们。
     */
    @Select("select MATCH_ID from lol_match where SCANNED = '0' order by GAME_START desc limit #{limit}")
    List<String> unscanned(@Param("limit") int limit);

    @Update("update lol_match set SCANNED = '1' where MATCH_ID = #{matchId}")
    int markScanned(@Param("matchId") String matchId);
}
