package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.LolSummoner;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Date;
import java.util.List;

public interface LolSummonerMapper extends BaseMapper<LolSummoner> {

    /**
     * 登记一个出现过的召唤师。已存在就只更新名字和「最近见过」。
     *
     * <p>用 {@code ON DUPLICATE KEY UPDATE} 而不是先查后插：一场十个人、几百场对局，
     * 先查再插是双倍往返；而且并发跑时「查到没有→插入」中间会撞主键。
     *
     * <p><b>不碰段位那几列</b>——登记只是说「这个人出现过」，
     * 覆盖掉已经查到的段位等于让后台白干一遍。
     */
    @Insert("insert into lol_summoner (PUUID, GAME_NAME, TAG_LINE, PLATFORM, LAST_SEEN) "
            + "values (#{puuid}, #{gameName}, #{tagLine}, #{platform}, #{lastSeen}) "
            + "on duplicate key update "
            + "  GAME_NAME = values(GAME_NAME), TAG_LINE = values(TAG_LINE), "
            + "  LAST_SEEN = greatest(LAST_SEEN, values(LAST_SEEN))")
    int upsert(@Param("puuid") String puuid, @Param("gameName") String gameName,
               @Param("tagLine") String tagLine, @Param("platform") String platform,
               @Param("lastSeen") Date lastSeen);

    /**
     * 下一批该补段位的人：**没查过的优先，然后按最近见过的排**。
     *
     * <p>顺序是这条查询的全部意义。库里有几千个路人，按限流全部补完要十几个小时，
     * 而其中绝大多数只出现过一次、没人会去看。按 {@code LAST_SEEN} 倒序补，
     * 意味着「昨晚那几场里的人」几分钟内就有段位，长尾慢慢来。
     *
     * <p>已经查过的**很久之后才刷**（段位对路人只是个参考，不值得反复消耗配额），
     * 所以这里只挑 RANK_UPDATED 为空的，刷新交给 staleRankTargets。
     */
    @Select("select PUUID from lol_summoner where RANK_UPDATED is null "
            + "order by LAST_SEEN desc limit #{limit}")
    List<String> pendingRankTargets(@Param("limit") int limit);

    /** 还差多少人没查过段位。用于日志和进度展示——长任务没有进度就没人知道它还活着 */
    @Select("select count(*) from lol_summoner where RANK_UPDATED is null")
    int pendingRankCount();
}
