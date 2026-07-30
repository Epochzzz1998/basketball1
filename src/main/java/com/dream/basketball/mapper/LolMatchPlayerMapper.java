package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.LolMatchPlayer;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 战绩流与榜单的查询。
 *
 * <h2>三条共同的过滤条件，缺一条榜就不可信</h2>
 *
 * <ol>
 *   <li>{@code EARLY_SURR = '0'} —— 排除重开局。三分钟就结束的局如果算进胜率，
 *       一晚上遇到两次挂机就能把一个人的数字打歪。</li>
 *   <li>{@code END_RESULT is null or = 'GameComplete'} —— 排除中断的对局。
 *       留 {@code is null} 是因为老数据可能没有这个字段。</li>
 *   <li><b>最低场次门槛</b> —— 这条不是过滤脏数据，是防止「1 场 100% 胜率排第一」。
 *       几百场规模的样本里任何「率」都不稳，没有门槛的榜第一天就会失去可信度。</li>
 * </ol>
 *
 * <h2>queueId 用 0 代表「全部」而不是 null</h2>
 *
 * 注解式 SQL 里判 null 要写成 {@code <script>} 动态 SQL，为一个可选条件引入整段模板
 * 不划算。0 不是任何真实队列的编号，拿它当哨兵值是安全的。
 */
public interface LolMatchPlayerMapper extends BaseMapper<LolMatchPlayer> {

    /**
     * 战绩流：最近的对局，每场带上其中的自己人。
     *
     * <p>返回的是「一场 × 一个人」的扁平行，同一场会出现多行，由调用方按 MATCH_ID 合并。
     * 不在 SQL 里聚合是因为一场里各人的英雄、KDA、位置都要分别展示，
     * 聚合成字符串再拆回来只是把解析工作挪个地方。
     *
     * <p>重开局这里**不过滤**：榜单要排除它，但战绩流该如实显示——
     * 「昨晚有两把重开」本身就是想知道的信息。
     */
    @Select("select m.MATCH_ID matchId, m.QUEUE_ID queueId, m.GAME_START gameStart, "
            + "       m.GAME_DURATION gameDuration, m.END_RESULT endResult, "
            + "       p.PUUID puuid, p.USER_ID userId, u.USER_NICKNAME nickname, u.AVATAR avatar, "
            + "       p.CHAMPION_NAME championName, p.TEAM_ID teamId, p.TEAM_POSITION teamPosition, "
            + "       p.WIN win, p.KILLS kills, p.DEATHS deaths, p.ASSISTS assists, "
            + "       p.CS cs, p.VISION vision, p.KDA kda, p.EARLY_SURR earlySurr "
            + "from lol_match m "
            + "join lol_match_player p on p.MATCH_ID = m.MATCH_ID "
            + "left join dream_user u on u.USER_ID = p.USER_ID "
            + "where m.GAME_START >= #{since} "
            + "order by m.GAME_START desc, m.MATCH_ID, p.TEAM_ID, p.PUUID")
    List<Map<String, Object>> feed(@Param("since") Date since);

    /**
     * 个人榜：按站内用户聚合。
     *
     * <p>KDA 取 {@code avg(KDA)} 而不是 {@code (总K+总A)/总D}：后者会被一场爆发局带飞，
     * 前者是「平均每局的表现」，更接近人们说「他 KDA 高」时的意思。
     * 两个都对，但要选一个并说清楚是哪个。
     */
    @Select("select p.USER_ID userId, u.USER_NICKNAME nickname, u.AVATAR avatar, "
            + "       count(*) games, "
            + "       sum(case when p.WIN = '1' then 1 else 0 end) wins, "
            + "       round(avg(p.KDA), 2) avgKda, "
            + "       sum(p.KILLS) kills, sum(p.DEATHS) deaths, sum(p.ASSISTS) assists, "
            + "       round(avg(p.KILL_PART), 4) avgKillPart, "
            + "       round(avg(p.DMG_SHARE), 4) avgDmgShare, "
            + "       round(avg(p.VISION), 1) avgVision, "
            + "       round(avg(p.CS / greatest(p.TIME_PLAYED / 60, 1)), 1) csPerMin "
            + "from lol_match_player p "
            + "join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "left join dream_user u on u.USER_ID = p.USER_ID "
            + "where p.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{queueId} = 0 or m.QUEUE_ID = #{queueId}) "
            + "group by p.USER_ID, u.USER_NICKNAME, u.AVATAR "
            + "having count(*) >= #{minGames} "
            + "order by sum(case when p.WIN = '1' then 1 else 0 end) / count(*) desc, games desc")
    List<Map<String, Object>> leaderboard(@Param("since") Date since,
                                          @Param("queueId") int queueId,
                                          @Param("minGames") int minGames);

    /**
     * 开黑组合榜：两个人同一场、同一队，才算一次一起打。
     *
     * <p>自连接加上 {@code a.USER_ID < b.USER_ID} 去掉镜像重复——不加的话
     * 「甲和乙」「乙和甲」会各算一遍。
     *
     * <p>这是整个模块最有价值的一条查询：公共平台永远给不出「我们几个之间」的数字。
     */
    @Select("select a.USER_ID u1, ua.USER_NICKNAME n1, b.USER_ID u2, ub.USER_NICKNAME n2, "
            + "       count(*) games, "
            + "       sum(case when a.WIN = '1' then 1 else 0 end) wins "
            + "from lol_match_player a "
            + "join lol_match_player b on b.MATCH_ID = a.MATCH_ID "
            + "     and b.TEAM_ID = a.TEAM_ID and a.USER_ID < b.USER_ID "
            + "join lol_match m on m.MATCH_ID = a.MATCH_ID "
            + "left join dream_user ua on ua.USER_ID = a.USER_ID "
            + "left join dream_user ub on ub.USER_ID = b.USER_ID "
            + "where a.EARLY_SURR = '0' and b.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{queueId} = 0 or m.QUEUE_ID = #{queueId}) "
            + "group by a.USER_ID, ua.USER_NICKNAME, b.USER_ID, ub.USER_NICKNAME "
            + "having count(*) >= #{minGames} "
            + "order by games desc, wins desc")
    List<Map<String, Object>> duoBoard(@Param("since") Date since,
                                       @Param("queueId") int queueId,
                                       @Param("minGames") int minGames);

    /**
     * 概览数字：这段时间里一共几场、其中几场是开黑（同队自己人 ≥ 2）。
     *
     * <p>开黑场次用子查询数「同一场同一队有几个自己人」，这就是策略文档里
     * 那条「开黑是派生的，不建表」的实现——实测 89% 的场次是开黑，
     * 这个数字本身就值得摆在页面顶上。
     */
    @Select("select count(*) totalMatches, "
            + "       sum(case when t.mates >= 2 then 1 else 0 end) premadeMatches "
            + "from ( "
            + "  select p.MATCH_ID, p.TEAM_ID, count(*) mates "
            + "  from lol_match_player p join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "  where m.GAME_START >= #{since} "
            + "  group by p.MATCH_ID, p.TEAM_ID "
            + ") t")
    Map<String, Object> summary(@Param("since") Date since);
}
