package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.LolMatchPlayer;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

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
 * <p>位置筛选（资料卡上点「中路」只看中路）走同一套。位置的取值是 Riot 的枚举
 * （TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY），同样不含逗号。但**比较的必须是归一后的值**：
 * 大乱斗没有分路，{@code TEAM_POSITION} 是空串，位置分布把它显示成「其它」（OTHER），
 * 筛选这一侧要是拿原始列去比，点「其它」就一场也筛不出来。所以两处用同一个
 * {@code ifnull(nullif(...))} 表达式——它是这两个查询之间的契约。
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
     * 账号榜：**按游戏账号（PUUID）聚合，不是按站内用户**。
     *
     * <h3>为什么从「按人」改成「按号」</h3>
     * 一个人可以绑多个号，而这些号往往段位差很远——大号铂金、小号白银。
     * 按人合并的话，两边的数据糅在一起：胜率是两个段位的加权平均，
     * 既不代表他在铂金什么水平，也不代表他在白银什么水平，**谁都不是**。
     * 而榜单本来就是拿来比的，比的对象必须是同一层的东西。
     *
     * <p>所属用户单独一列——这样「这是谁的号」这个信息没丢，
     * 只是不再当成聚合的单位。
     *
     * <h3>rankScore 直接在这里算</h3>
     * 每行本来就是一个账号，段位是它自己的属性，不必再去别处取「最高的那个号」。
     * 折算规则：大段 × 10000 + 小段 × 100 + LP；未定级给 -10000 保证沉底。
     * 大段和小段都必须显式列出来——字母序会把 GOLD 排到 IRON 前面、IV 排到 I 前面，正好都反。
     */
    @Select("select p.PUUID puuid, a.GAME_NAME gameName, a.TAG_LINE tagLine, "
            + "       a.TIER tier, a.RANK_DIV rankDiv, a.LEAGUE_POINT leaguePoint, "
            + "       (case a.TIER when 'IRON' then 0 when 'BRONZE' then 1 when 'SILVER' then 2 "
            + "                    when 'GOLD' then 3 when 'PLATINUM' then 4 when 'EMERALD' then 5 "
            + "                    when 'DIAMOND' then 6 when 'MASTER' then 7 "
            + "                    when 'GRANDMASTER' then 8 when 'CHALLENGER' then 9 "
            + "                    else -1 end) * 10000 "
            + "     + (case a.RANK_DIV when 'IV' then 0 when 'III' then 1 "
            + "                        when 'II' then 2 when 'I' then 3 else 0 end) * 100 "
            + "     + ifnull(a.LEAGUE_POINT, 0) rankScore, "
            + "       p.USER_ID userId, u.USER_NICKNAME ownerName, u.AVATAR ownerAvatar, "
            + "       count(*) games, "
            + "       sum(case when p.WIN = '1' then 1 else 0 end) wins, "
            + "       round(avg(p.KDA), 2) avgKda, "
            + "       sum(p.KILLS) kills, sum(p.DEATHS) deaths, sum(p.ASSISTS) assists, "
            + "       round(avg(p.KILL_PART), 4) avgKillPart, "
            + "       round(avg(p.DMG_SHARE), 4) avgDmgShare, "
            // nullif(...,0)：0 是「补过但原文里没有」的哨兵，把它当成真的 0% 会把均值拉低。
            // avg 自动跳过 null，所以这么写正好只统计真拿到值的那些场
            + "       round(avg(nullif(p.TAKEN_SHARE, 0)), 4) avgTakenShare, "
            + "       round(avg(p.DMG_CHAMP / greatest(p.GOLD, 1)), 3) avgDmgPerGold, "
            + "       round(avg(p.VISION), 1) avgVision, "
            + "       round(avg(p.CS / greatest(p.TIME_PLAYED / 60, 1)), 1) csPerMin "
            + "from lol_match_player p "
            + "join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "left join lol_account a on a.PUUID = p.PUUID "
            + "left join dream_user u on u.USER_ID = p.USER_ID "
            + "where p.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{queueId} = 0 or m.QUEUE_ID = #{queueId}) "
            + "group by p.PUUID, a.GAME_NAME, a.TAG_LINE, a.TIER, a.RANK_DIV, a.LEAGUE_POINT, "
            + "         p.USER_ID, u.USER_NICKNAME, u.AVATAR "
            + "having count(*) >= #{minGames} "
            + "order by sum(case when p.WIN = '1' then 1 else 0 end) / count(*) desc, games desc")
    List<Map<String, Object>> leaderboard(@Param("since") Date since,
                                          @Param("queueId") int queueId,
                                          @Param("minGames") int minGames);

    /**
     * 开黑组合榜：**按游戏账号配对**，同一场同一队才算一次一起打。
     *
     * <p>和账号榜同理——按人配对的话，「甲的小号 + 乙的大号」和
     * 「甲的大号 + 乙的大号」会被算成同一对，而那其实是两种完全不同的组合。
     *
     * <p>{@code a.PUUID < b.PUUID} 去掉镜像重复。用 PUUID 而不是 USER_ID 还顺带
     * 解决了一件事：同一个人的两个号不可能出现在同一场里，所以不必再排除自我配对。
     */
    @Select("select a.PUUID p1, aa.GAME_NAME g1, aa.TAG_LINE t1, ua.USER_NICKNAME n1, "
            + "       b.PUUID p2, ab.GAME_NAME g2, ab.TAG_LINE t2, ub.USER_NICKNAME n2, "
            + "       count(*) games, "
            + "       sum(case when a.WIN = '1' then 1 else 0 end) wins "
            + "from lol_match_player a "
            + "join lol_match_player b on b.MATCH_ID = a.MATCH_ID "
            + "     and b.TEAM_ID = a.TEAM_ID and a.PUUID < b.PUUID "
            + "join lol_match m on m.MATCH_ID = a.MATCH_ID "
            + "left join lol_account aa on aa.PUUID = a.PUUID "
            + "left join lol_account ab on ab.PUUID = b.PUUID "
            + "left join dream_user ua on ua.USER_ID = a.USER_ID "
            + "left join dream_user ub on ub.USER_ID = b.USER_ID "
            + "where a.EARLY_SURR = '0' and b.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{queueId} = 0 or m.QUEUE_ID = #{queueId}) "
            + "group by a.PUUID, aa.GAME_NAME, aa.TAG_LINE, ua.USER_NICKNAME, "
            + "         b.PUUID, ab.GAME_NAME, ab.TAG_LINE, ub.USER_NICKNAME "
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
     *
     * <p>可以按位置筛：点了「打野」就只剩他打野时的英雄池。这比整体英雄池更接近
     * 人们真正想问的「他打野能玩什么」——同一个英雄在中路和在打野是两套打法。
     */
    @Select("select p.CHAMPION_NAME championName, count(*) games, "
            + "       sum(case when p.WIN = '1' then 1 else 0 end) wins, "
            + "       round(avg(p.KDA), 2) avgKda, "
            + "       round(avg(p.DMG_SHARE), 4) avgDmgShare, "
            + "       round(avg(nullif(p.TAKEN_SHARE, 0)), 4) avgTakenShare "
            + "from lol_match_player p join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "where p.USER_ID = #{userId} and p.EARLY_SURR = '0' "
            + "  and (m.END_RESULT is null or m.END_RESULT = 'GameComplete') "
            + "  and m.GAME_START >= #{since} "
            + "  and (#{puuids} = '' or find_in_set(p.PUUID, #{puuids})) "
            + "  and (#{positions} = '' "
            + "       or find_in_set(ifnull(nullif(p.TEAM_POSITION, ''), 'OTHER'), #{positions})) "
            + "group by p.CHAMPION_NAME order by games desc, wins desc limit 12")
    List<Map<String, Object>> championPool(@Param("userId") String userId, @Param("since") Date since,
                                           @Param("puuids") String puuids,
                                           @Param("positions") String positions);

    /**
     * 一个人的位置分布。空的 TEAM_POSITION 归到「其它」，大乱斗没有分路。
     *
     * <p><b>这一条不受位置筛选影响</b>：它就是那排开关本身。跟着筛的话，
     * 点「中路」之后其余位置全部消失，也就再也点不回来了。
     */
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
            + "       round(avg(nullif(p.TAKEN_SHARE, 0)), 4) avgTakenShare, "
            + "       round(avg(p.DMG_CHAMP / greatest(p.GOLD, 1)), 3) avgDmgPerGold, "
            + "       round(avg(p.VISION), 1) avgVision, "
            + "       round(avg(p.CS / greatest(p.TIME_PLAYED / 60, 1)), 1) csPerMin, "
            + "       round(avg(p.DMG_CHAMP), 0) avgDmg, "
            + "       round(avg(p.DMG_TAKEN), 0) avgTaken, "
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
            + "       p.CS cs, p.GOLD gold, p.DMG_CHAMP dmgChamp, p.DMG_TAKEN dmgTaken, "
            + "       p.VISION vision, "
            + "       p.KILL_PART killPart, p.DMG_SHARE dmgShare, "
            // 承伤占比要存（分母是全队五个人，其中路人不在这张表里）；
            // 伤转反过来——分母就是他自己的经济，同一行就有，现算比多存一列划算
            + "       nullif(p.TAKEN_SHARE, 0) takenShare, "
            + "       round(p.DMG_CHAMP / greatest(p.GOLD, 1), 3) dmgPerGold, "
            + "       p.EARLY_SURR earlySurr, "
            + "       p.TIME_PLAYED timePlayed "
            + "from lol_match_player p join lol_match m on m.MATCH_ID = p.MATCH_ID "
            + "where p.USER_ID = #{userId} and m.GAME_START >= #{since} "
            + "  and (#{puuids} = '' or find_in_set(p.PUUID, #{puuids})) "
            + "  and (#{positions} = '' "
            + "       or find_in_set(ifnull(nullif(p.TEAM_POSITION, ''), 'OTHER'), #{positions})) "
            + "order by m.GAME_START desc limit 60")
    List<Map<String, Object>> playerMatches(@Param("userId") String userId, @Param("since") Date since,
                                            @Param("puuids") String puuids,
                                            @Param("positions") String positions);

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

    // ───────────────────────────────────────────── 承伤占比的回填
    //
    // 这一项一直躺在 RAW_GZ 里，只是当初没往列上存。补它**一次 API 都不用打**，
    // 全是本地解压 + 解析。用 0 当「查过了但补不出来」的占位值：
    // 真实的承伤占比不可能是 0（一场里每个人多少都要挨点伤害），
    // 所以拿它当哨兵不会和真数据混淆，读取时 nullif 掉即可。

    /** 还有行没补过承伤占比的对局。补完之后这条返回空，整个步骤自然停下 */
    @Select("select distinct MATCH_ID from lol_match_player "
            + "where TAKEN_SHARE is null limit #{n}")
    List<String> matchesMissingTakenShare(@Param("n") int n);

    @Update("update lol_match_player set TAKEN_SHARE = #{v} "
            + "where MATCH_ID = #{matchId} and PUUID = #{puuid} and TAKEN_SHARE is null")
    void fillTakenShare(@Param("matchId") String matchId, @Param("puuid") String puuid,
                        @Param("v") java.math.BigDecimal v);

    /** 这一场处理过了：剩下还为空的写 0 占位，免得每轮都被重新挑中 */
    @Update("update lol_match_player set TAKEN_SHARE = 0 "
            + "where MATCH_ID = #{matchId} and TAKEN_SHARE is null")
    void markTakenShareUnknown(@Param("matchId") String matchId);
}
