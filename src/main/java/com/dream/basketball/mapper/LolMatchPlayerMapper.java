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
 * <h2>「只看这几个号」用逗号串 + FIND_IN_SET</h2>
 *
 * 资料卡允许勾选要看哪几个绑定账号。注解式 SQL 传集合要写 {@code <script>} + {@code foreach}，
 * 为一个可选过滤引入整段模板不划算。PUUID 的字符集是 base64url（字母、数字、`-`、`_`），
 * **不含逗号**，所以拼成逗号串再 {@code FIND_IN_SET} 是安全的；空串表示不筛。
 *
 * <h2>queueId 用 0 代表「全部」而不是 null</h2>
 *
 * 注解式 SQL 里判 null 要写成 {@code <script>} 动态 SQL，为一个可选条件引入整段模板
 * 不划算。0 不是任何真实队列的编号，拿它当哨兵值是安全的。
 */
public interface LolMatchPlayerMapper extends BaseMapper<LolMatchPlayer> {

    /**
     * 战绩流：一段时间内的对局，每场带上其中的自己人。
     *
     * <p>返回的是「一场 × 一个人」的扁平行，同一场会出现多行，由调用方按 MATCH_ID 合并。
     * 不在 SQL 里聚合是因为一场里各人的英雄、KDA、位置都要分别展示，
     * 聚合成字符串再拆回来只是把解析工作挪个地方。
     *
     * <p>重开局这里**不过滤**：榜单要排除它，但战绩流该如实显示——
     * 「昨晚有两把重开」本身就是想知道的信息。
     *
     * <h3>为什么统一用 since/until 区间，而不是「天数」或「某一天」两套</h3>
     * 选某一天 = {@code [当天 00:00, 次日 00:00)}，选最近 N 天 = {@code [now-N, 很远的将来)}。
     * 两种筛选是同一个形状，写成一个区间就不用为「日期模式」再复制一条几乎一样的 SQL。
     *
     * <h3>玩家搜索：站内昵称和游戏 ID 都认</h3>
     * 用 {@code exists} 而不是把过滤条件直接加在 join 上：直接加的话，
     * 命中的那一场**只会剩下匹配的那一个人**，而我们要的是「这一场完整地留下」——
     * 搜某个人是为了看他打的那些局，包括同场的队友是谁。
     * 空串表示不筛（同 queueId 用 0，理由见类注释）。
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
            + "where m.GAME_START >= #{since} and m.GAME_START < #{until} "
            + "  and (#{queueId} = 0 or m.QUEUE_ID = #{queueId}) "
            + "  and (#{player} = '' or exists ( "
            + "        select 1 from lol_match_player p2 "
            + "        left join dream_user u2 on u2.USER_ID = p2.USER_ID "
            + "        left join lol_account a2 on a2.PUUID = p2.PUUID "
            + "        where p2.MATCH_ID = m.MATCH_ID "
            + "          and (u2.USER_NICKNAME like concat('%', #{player}, '%') "
            + "            or a2.GAME_NAME like concat('%', #{player}, '%')) )) "
            + "order by m.GAME_START desc, m.MATCH_ID, p.TEAM_ID, p.PUUID")
    List<Map<String, Object>> feed(@Param("since") Date since,
                                   @Param("until") Date until,
                                   @Param("queueId") int queueId,
                                   @Param("player") String player);

    /**
     * 某个月里哪几天有对局，给日历上的标注用。
     *
     * <p>只回日期字符串，不回场次——日历格子上就是标个底色，多带的数据在网络上白走一趟。
     */
    @Select("select distinct date_format(GAME_START, '%Y-%m-%d') from lol_match "
            + "where GAME_START >= #{since} and GAME_START < #{until} order by 1")
    List<String> matchDates(@Param("since") Date since, @Param("until") Date until);

    /** 搜索用的候选名单：站内昵称 + 绑定的游戏 ID。前端拿它做输入提示 */
    @Select("select distinct u.USER_NICKNAME nickname, a.GAME_NAME gameName, a.TAG_LINE tagLine "
            + "from lol_account a left join dream_user u on u.USER_ID = a.USER_ID "
            + "where a.ENABLED = '1' order by u.USER_NICKNAME")
    List<Map<String, Object>> searchOptions();

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

    /**
     * 一个人的英雄池：各英雄打了几把、赢了几把、平均 KDA。
     *
     * <p>这是资料卡里最有意思的一块——「他到底玩什么」和「玩什么最强」
     * 是队友之间真正会讨论的事，而这两个问题各自的答案常常不一样。
     */
    @Select("select p.CHAMPION_NAME championName, count(*) games, "
            + "       sum(case when p.WIN = '1' then 1 else 0 end) wins, "
            + "       round(avg(p.KDA), 2) avgKda, "
            + "       round(avg(p.DMG_SHARE), 4) avgDmgShare "
            + "from lol_match_player p join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "where p.USER_ID = #{userId} and p.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{puuids} = '' or find_in_set(p.PUUID, #{puuids})) "
            + "group by p.CHAMPION_NAME order by games desc, wins desc limit 12")
    List<Map<String, Object>> championPool(@Param("userId") String userId, @Param("since") Date since,
                                           @Param("puuids") String puuids);

    /** 一个人的位置分布。空的 TEAM_POSITION 归到「其它」，大乱斗没有分路 */
    @Select("select ifnull(nullif(p.TEAM_POSITION, ''), 'OTHER') pos, count(*) games, "
            + "       sum(case when p.WIN = '1' then 1 else 0 end) wins "
            + "from lol_match_player p join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "where p.USER_ID = #{userId} and p.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{puuids} = '' or find_in_set(p.PUUID, #{puuids})) "
            + "group by pos order by games desc")
    List<Map<String, Object>> positionMix(@Param("userId") String userId, @Param("since") Date since,
                                          @Param("puuids") String puuids);

    /**
     * 一个人的汇总。**不复用 leaderboard 的那一条**：那条带最低场次门槛，
     * 而资料卡是点进来看具体某个人的，哪怕他只打过两把也该显示——
     * 门槛存在的意义是「别让 1 场 100% 的人霸榜」，对单人视图没有这个问题。
     */
    @Select("select count(*) games, "
            + "       sum(case when p.WIN = '1' then 1 else 0 end) wins, "
            + "       round(avg(p.KDA), 2) avgKda, "
            + "       sum(p.KILLS) kills, sum(p.DEATHS) deaths, sum(p.ASSISTS) assists, "
            + "       round(avg(p.KILL_PART), 4) avgKillPart, "
            + "       round(avg(p.DMG_SHARE), 4) avgDmgShare, "
            + "       round(avg(p.VISION), 1) avgVision, "
            + "       round(avg(p.CS / greatest(p.TIME_PLAYED / 60, 1)), 1) csPerMin, "
            + "       round(avg(p.DMG_CHAMP), 0) avgDmg, "
            + "       max(p.KILLS) maxKills "
            + "from lol_match_player p join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "where p.USER_ID = #{userId} and p.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{puuids} = '' or find_in_set(p.PUUID, #{puuids}))")
    Map<String, Object> playerSummary(@Param("userId") String userId, @Param("since") Date since,
                                      @Param("puuids") String puuids);

    /** 这个人最常一起打的队友。资料卡上比全站组合榜更贴身 */
    @Select("select b.USER_ID userId, ub.USER_NICKNAME nickname, count(*) games, "
            + "       sum(case when a.WIN = '1' then 1 else 0 end) wins "
            + "from lol_match_player a "
            + "join lol_match_player b on b.MATCH_ID = a.MATCH_ID and b.TEAM_ID = a.TEAM_ID "
            + "     and b.USER_ID <> a.USER_ID "
            + "join lol_match m on m.MATCH_ID = a.MATCH_ID "
            + "left join dream_user ub on ub.USER_ID = b.USER_ID "
            + "where a.USER_ID = #{userId} and a.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{puuids} = '' or find_in_set(a.PUUID, #{puuids})) "
            + "group by b.USER_ID, ub.USER_NICKNAME order by games desc limit 8")
    List<Map<String, Object>> mates(@Param("userId") String userId, @Param("since") Date since,
                                    @Param("puuids") String puuids);

    /**
     * 每个站内用户「最高的那个号」的段位。
     *
     * <p>一个人可以绑小号，各号段位不同，榜上只能显示一个——取**最高**的那个，
     * 因为人们说「他什么段位」时说的就是他最强的号。
     *
     * <p>排序要靠一个可比的数，所以把段位折成分数：
     * {@code 大段 × 10000 + 小段 × 100 + LP}。大段的顺序是 Riot 定的（黑铁最低、王者最高），
     * 小段是 IV→I 递增，两者都必须显式写出来——字母序会把 GOLD 排到 IRON 前面、
     * 把 IV 排到 I 前面，正好都反了。
     *
     * <p>大师以上没有小段，那一位算 0；未定级（TIER 为空）给 -1，
     * 保证它永远排在所有已定级的后面，而不是被当成黑铁。
     */
    @Select("select USER_ID userId, TIER tier, RANK_DIV rankDiv, LEAGUE_POINT leaguePoint, score "
            + "from ( "
            + "  select USER_ID, TIER, RANK_DIV, LEAGUE_POINT, "
            + "         (case TIER when 'IRON' then 0 when 'BRONZE' then 1 when 'SILVER' then 2 "
            + "                    when 'GOLD' then 3 when 'PLATINUM' then 4 when 'EMERALD' then 5 "
            + "                    when 'DIAMOND' then 6 when 'MASTER' then 7 "
            + "                    when 'GRANDMASTER' then 8 when 'CHALLENGER' then 9 "
            + "                    else -1 end) * 10000 "
            + "       + (case RANK_DIV when 'IV' then 0 when 'III' then 1 "
            + "                        when 'II' then 2 when 'I' then 3 else 0 end) * 100 "
            + "       + ifnull(LEAGUE_POINT, 0) score, "
            + "         row_number() over (partition by USER_ID order by "
            + "           (case TIER when 'IRON' then 0 when 'BRONZE' then 1 when 'SILVER' then 2 "
            + "                      when 'GOLD' then 3 when 'PLATINUM' then 4 when 'EMERALD' then 5 "
            + "                      when 'DIAMOND' then 6 when 'MASTER' then 7 "
            + "                      when 'GRANDMASTER' then 8 when 'CHALLENGER' then 9 "
            + "                      else -1 end) desc, ifnull(LEAGUE_POINT, 0) desc) rn "
            + "  from lol_account where ENABLED = '1' "
            + ") t where rn = 1")
    List<Map<String, Object>> bestRanks();

    /**
     * 一个人自己的对局列表，给资料卡用。
     *
     * <p>和战绩流不是一回事：战绩流以**对局**为单位（这一把我们上了谁），
     * 这里以**这个人**为单位（他每一把打了什么、打成什么样）。
     * 所以这条只回他自己那一行，不带同场的其他人。
     */
    @Select("select m.MATCH_ID matchId, m.QUEUE_ID queueId, m.GAME_START gameStart, "
            + "       m.GAME_DURATION gameDuration, "
            + "       p.CHAMPION_NAME championName, p.TEAM_POSITION teamPosition, p.WIN win, "
            + "       p.KILLS kills, p.DEATHS deaths, p.ASSISTS assists, p.KDA kda, "
            + "       p.CS cs, p.GOLD gold, p.DMG_CHAMP dmgChamp, p.VISION vision, "
            + "       p.KILL_PART killPart, p.DMG_SHARE dmgShare, p.EARLY_SURR earlySurr, "
            + "       p.TIME_PLAYED timePlayed "
            + "from lol_match_player p join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "where p.USER_ID = #{userId} and m.GAME_START >= #{since} "
            + "  and (#{puuids} = '' or find_in_set(p.PUUID, #{puuids})) "
            + "order by m.GAME_START desc limit 60")
    List<Map<String, Object>> playerMatches(@Param("userId") String userId, @Param("since") Date since,
                                            @Param("puuids") String puuids);

    /**
     * 这个人每个号最后一次打是什么时候。
     *
     * <p>资料卡默认只勾**最近在玩的那个号**。用 `LAST_SYNC` 是不行的——那是「我们上次去问 Riot 的时刻」，
     * 每个号每轮都会更新，和这个人实际在玩哪个号毫无关系。真正的判据是最后一场对局的时间。
     */
    @Select("select p.PUUID puuid, max(m.GAME_START) lastPlayed "
            + "from lol_match_player p join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "where p.USER_ID = #{userId} group by p.PUUID")
    List<Map<String, Object>> lastPlayedByAccount(@Param("userId") String userId);
}
