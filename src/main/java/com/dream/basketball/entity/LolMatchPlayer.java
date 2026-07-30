package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * 一场对局里**已绑定用户**那几行。那 5 个路人不存。
 *
 * <p>不存路人不是为了省空间，是因为它们没有查询价值：路人不会出现在任何榜里，
 * 而真需要看「这一场对面是谁」时，十个人的完整数据本来就躺在 {@link LolMatch} 的 RAW_GZ 里。
 * 存进来只会让表大十倍、每条榜单的 SQL 都要多一个过滤条件。
 *
 * <p><b>开黑是派生的，没有单独的表</b>：同一场里 TEAM_ID 相同的绑定用户 ≥ 2，就是一次开黑。
 * 先用 group by 查，等榜单真的慢了再物化——一开始就建冗余表，等于用确定的维护成本
 * 换一个还没发生的性能问题。
 */
@TableName("lol_match_player")
public class LolMatchPlayer extends Model<LolMatchPlayer> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId("MATCH_ID")
    private String matchId;

    /** 与 MATCH_ID 组成联合主键 */
    @TableField("PUUID")
    private String puuid;

    /** 冗余一份。榜单按站内用户聚合时免一次 join */
    @TableField("USER_ID")
    private String userId;

    @TableField("CHAMPION_ID")
    private Integer championId;

    @TableField("CHAMPION_NAME")
    private String championName;

    /** 100 / 200 */
    @TableField("TEAM_ID")
    private Integer teamId;

    /** TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY，可能为空串 */
    @TableField("TEAM_POSITION")
    private String teamPosition;

    /** '1' / '0' */
    @TableField("WIN")
    private String win;

    @TableField("KILLS")
    private Integer kills;

    @TableField("DEATHS")
    private Integer deaths;

    @TableField("ASSISTS")
    private Integer assists;

    @TableField("GOLD")
    private Integer gold;

    /** 对英雄总伤害 */
    @TableField("DMG_CHAMP")
    private Integer dmgChamp;

    @TableField("DMG_TAKEN")
    private Integer dmgTaken;

    @TableField("VISION")
    private Integer vision;

    /** 小兵 + 野怪 */
    @TableField("CS")
    private Integer cs;

    @TableField("CHAMP_LEVEL")
    private Integer champLevel;

    /** 秒。提前退出时会小于对局时长 */
    @TableField("TIME_PLAYED")
    private Integer timePlayed;

    /** challenges.kda。用 Riot 算好的，0 死亡时它不是除零 */
    @TableField("KDA")
    private BigDecimal kda;

    /** challenges.killParticipation */
    @TableField("KILL_PART")
    private BigDecimal killPart;

    /** challenges.teamDamagePercentage */
    @TableField("DMG_SHARE")
    private BigDecimal dmgShare;

    /** '1' = 重开局。必须排除在榜单之外，否则胜率被一堆 3 分钟的局污染 */
    @TableField("EARLY_SURR")
    private String earlySurr;

    public String getMatchId() {
        return matchId;
    }

    public void setMatchId(String matchId) {
        this.matchId = matchId;
    }

    public String getPuuid() {
        return puuid;
    }

    public void setPuuid(String puuid) {
        this.puuid = puuid;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public Integer getChampionId() {
        return championId;
    }

    public void setChampionId(Integer championId) {
        this.championId = championId;
    }

    public String getChampionName() {
        return championName;
    }

    public void setChampionName(String championName) {
        this.championName = championName;
    }

    public Integer getTeamId() {
        return teamId;
    }

    public void setTeamId(Integer teamId) {
        this.teamId = teamId;
    }

    public String getTeamPosition() {
        return teamPosition;
    }

    public void setTeamPosition(String teamPosition) {
        this.teamPosition = teamPosition;
    }

    public String getWin() {
        return win;
    }

    public void setWin(String win) {
        this.win = win;
    }

    public Integer getKills() {
        return kills;
    }

    public void setKills(Integer kills) {
        this.kills = kills;
    }

    public Integer getDeaths() {
        return deaths;
    }

    public void setDeaths(Integer deaths) {
        this.deaths = deaths;
    }

    public Integer getAssists() {
        return assists;
    }

    public void setAssists(Integer assists) {
        this.assists = assists;
    }

    public Integer getGold() {
        return gold;
    }

    public void setGold(Integer gold) {
        this.gold = gold;
    }

    public Integer getDmgChamp() {
        return dmgChamp;
    }

    public void setDmgChamp(Integer dmgChamp) {
        this.dmgChamp = dmgChamp;
    }

    public Integer getDmgTaken() {
        return dmgTaken;
    }

    public void setDmgTaken(Integer dmgTaken) {
        this.dmgTaken = dmgTaken;
    }

    public Integer getVision() {
        return vision;
    }

    public void setVision(Integer vision) {
        this.vision = vision;
    }

    public Integer getCs() {
        return cs;
    }

    public void setCs(Integer cs) {
        this.cs = cs;
    }

    public Integer getChampLevel() {
        return champLevel;
    }

    public void setChampLevel(Integer champLevel) {
        this.champLevel = champLevel;
    }

    public Integer getTimePlayed() {
        return timePlayed;
    }

    public void setTimePlayed(Integer timePlayed) {
        this.timePlayed = timePlayed;
    }

    public BigDecimal getKda() {
        return kda;
    }

    public void setKda(BigDecimal kda) {
        this.kda = kda;
    }

    public BigDecimal getKillPart() {
        return killPart;
    }

    public void setKillPart(BigDecimal killPart) {
        this.killPart = killPart;
    }

    public BigDecimal getDmgShare() {
        return dmgShare;
    }

    public void setDmgShare(BigDecimal dmgShare) {
        this.dmgShare = dmgShare;
    }

    public String getEarlySurr() {
        return earlySurr;
    }

    public void setEarlySurr(String earlySurr) {
        this.earlySurr = earlySurr;
    }

}