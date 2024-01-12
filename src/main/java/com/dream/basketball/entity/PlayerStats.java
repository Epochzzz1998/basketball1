package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import org.hibernate.annotations.Comment;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

/**
 * @Author Epoch
 * @Description 球员数据实体类
 * @Date 2023/2/1 11:04
 * @Param
 * @return
 **/
@Entity
@Table(name = "PLAYER_STATS")
public class PlayerStats extends Model<PlayerStats> implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "STATS_ID", columnDefinition = "VARCHAR2(100)")
    @Comment("数据ID")
    @TableId(value = "STATS_ID", type = IdType.INPUT)
    private String statsId;

    @Column(name = "PLAYER_ID", columnDefinition = "VARCHAR2(100)")
    @Comment("球员ID")
    @TableField("PLAYER_ID")
    private String playerId;

    @Column(name = "SEASON", columnDefinition = "NUMBER(2)")
    @Comment("赛季")
    @TableField("SEASON")
    private Integer season;

    @Column(name = "PLAYING_TIME", columnDefinition = "NUMBER(18,6)")
    @Comment("上场时间")
    @TableField("PLAYING_TIME")
    private BigDecimal playingTime;

    @Column(name = "PLAYER_AVG_SCORE", columnDefinition = "NUMBER(18,6)")
    @Comment("场均得分")
    @TableField("PLAYER_AVG_SCORE")
    private BigDecimal playerAvgScore;

    @Column(name = "SEASON_NUM", columnDefinition = "NUMBER(2)")
    @Comment("第多少个赛季")
    @TableField("SEASON_NUM")
    private Integer seasonNum;

    @Column(name = "PLAYER_TEAM", columnDefinition = "VARCHAR2(32)")
    @Comment("所在球队")
    @TableField("PLAYER_TEAM")
    private String playerTeam;

    @Column(name = "PLAYER_POSITION", columnDefinition = "VARCHAR2(32)")
    @Comment("球员位置")
    @TableField("PLAYER_POSITION")
    private String playerPosition;

    @Column(name = "PLAYER_AVG_REB", columnDefinition = "NUMBER(18,6)")
    @Comment("场均篮板")
    @TableField("PLAYER_AVG_REB")
    private BigDecimal playerAvgReb;

    @Column(name = "PLAYER_AVG_ASS", columnDefinition = "NUMBER(18,6)")
    @Comment("场均助攻")
    @TableField("PLAYER_AVG_ASS")
    private BigDecimal playerAvgAss;

    @Column(name = "PLAYER_ACCURACY", columnDefinition = "NUMBER(18,6)")
    @Comment("命中率")
    @TableField("PLAYER_ACCURACY")
    private BigDecimal playerAccuracy;

    @Column(name = "PLAYER_THREE_ACCURACY", columnDefinition = "NUMBER(18,6)")
    @Comment("三分命中率")
    @TableField("PLAYER_THREE_ACCURACY")
    private BigDecimal playerThreeAccuracy;

    @Column(name = "PLAYER_FREETHROW_ACCURACY", columnDefinition = "NUMBER(18,6)")
    @Comment("罚球中率")
    @TableField("PLAYER_FREETHROW_ACCURACY")
    private BigDecimal playerFreethrowAccuracy;

    @Column(name = "PLAYER_AVG_BLOCK", columnDefinition = "NUMBER(18,6)")
    @Comment("场均盖帽")
    @TableField("PLAYER_AVG_BLOCK")
    private BigDecimal playerAvgBlock;

    @Column(name = "PLAYER_AVG_STEAL", columnDefinition = "NUMBER(18,6)")
    @Comment("场均抢断")
    @TableField("PLAYER_AVG_STEAL")
    private BigDecimal playerAvgSteal;

    @Column(name = "PLAYER_AVG_TURNOVER", columnDefinition = "NUMBER(18,6)")
    @Comment("场均失误")
    @TableField("PLAYER_AVG_TURNOVER")
    private BigDecimal playerAvgTurnover;

    @Column(name = "PLAYER_PER", columnDefinition = "NUMBER(18,6)")
    @Comment("PER值")
    @TableField("PLAYER_PER")
    private BigDecimal playerPer;

    @Column(name = "PLAYER_PIE", columnDefinition = "NUMBER(18,6)")
    @Comment("比赛贡献值")
    @TableField("PLAYER_PIE")
    private BigDecimal playerPie;

    @Column(name = "PLAYER_WS", columnDefinition = "NUMBER(18,6)")
    @Comment("胜利贡献值")
    @TableField("PLAYER_WS")
    private BigDecimal playerWs;

    @Column(name = "PLAYER_OFF_EFF", columnDefinition = "NUMBER(18,6)")
    @Comment("球员进攻效率值")
    @TableField("PLAYER_OFF_EFF")
    private BigDecimal playerOffEff;

    @Column(name = "PLAYER_DEF_EFF", columnDefinition = "NUMBER(18,6)")
    @Comment("球员防守效率值")
    @TableField("PLAYER_DEF_EFF")
    private BigDecimal playerDefEff;

    @Column(name = "PLAYER_NET_EFF", columnDefinition = "NUMBER(18,6)")
    @Comment("球员净效率值")
    @TableField("PLAYER_NET_EFF")
    private BigDecimal playerNetEff;

    @Column(name = "PLAYER_AVG_PN", columnDefinition = "NUMBER(18,6)")
    @Comment("球员场均正负值")
    @TableField("PLAYER_AVG_PN")
    private BigDecimal playerAvgPn;

    @Column(name = "MVP_RANK", columnDefinition = "NUMBER(3)")
    @Comment("MVP排名")
    @TableField("MVP_RANK")
    private Integer mvpRank;

    @Column(name = "DPOY_RANK", columnDefinition = "NUMBER(3)")
    @Comment("DPOY排名")
    @TableField("DPOY_RANK")
    private Integer dpoyRank;

    @Column(name = "ALL_DBA_TEAM", columnDefinition = "VARCHAR2(32)")
    @Comment("最佳阵容")
    @TableField("ALL_DBA_TEAM")
    private String allDbaTeam;

    @Column(name = "ALL_DEF_TEAM", columnDefinition = "VARCHAR2(32)")
    @Comment("最佳防守阵容")
    @TableField("ALL_DEF_TEAM")
    private String allDefTeam;

    @Column(name = "PLAYER_FR_APPEARANCE", columnDefinition = "NUMBER(2)")
    @Comment("球员首发出场次数")
    @TableField("PLAYER_FR_APPEARANCE")
    private Integer playerFrAppearance;

    @Column(name = "PLAYER_SR_APPEARANCE", columnDefinition = "NUMBER(2)")
    @Comment("球员替补出场次数")
    @TableField("PLAYER_SR_APPEARANCE")
    private Integer playerSrAppearance;

    @Column(name = "PLAYER_APPEARANCE", columnDefinition = "NUMBER(2)")
    @Comment("球员总出场次数")
    @TableField("PLAYER_APPEARANCE")
    private Integer playerAppearance;

    @Override
    public String toString() {
        return "PlayerStats{" +
                "statsId='" + statsId + '\'' +
                ", playerId='" + playerId + '\'' +
                ", season=" + season +
                ", playingTime=" + playingTime +
                ", playerAvgScore=" + playerAvgScore +
                ", seasonNum=" + seasonNum +
                ", playerTeam='" + playerTeam + '\'' +
                ", playerPosition='" + playerPosition + '\'' +
                ", playerAvgReb=" + playerAvgReb +
                ", playerAvgAss=" + playerAvgAss +
                ", playerAccuracy=" + playerAccuracy +
                ", playerThreeAccuracy=" + playerThreeAccuracy +
                ", playerAvgBlock=" + playerAvgBlock +
                ", playerAvgSteal=" + playerAvgSteal +
                ", playerAvgTurnover=" + playerAvgTurnover +
                ", playerPer=" + playerPer +
                ", playerPie=" + playerPie +
                ", playerWs=" + playerWs +
                ", playerOffEff=" + playerOffEff +
                ", playerDefEff=" + playerDefEff +
                ", playerNetEff=" + playerNetEff +
                ", playerAvgPn=" + playerAvgPn +
                ", mvpRank=" + mvpRank +
                ", dpoyRank=" + dpoyRank +
                ", allDbaTeam='" + allDbaTeam + '\'' +
                ", allDefTeam='" + allDefTeam + '\'' +
                ", playerFrAppearance=" + playerFrAppearance +
                ", playerSrAppearance=" + playerSrAppearance +
                ", playerAppearance=" + playerAppearance +
                '}';
    }

    public String getStatsId() {
        return statsId;
    }

    public void setStatsId(String statsId) {
        this.statsId = statsId;
    }

    public String getPlayerId() {
        return playerId;
    }

    public void setPlayerId(String playerId) {
        this.playerId = playerId;
    }

    public BigDecimal getPlayingTime() {
        return playingTime;
    }

    public void setPlayingTime(BigDecimal playingTime) {
        this.playingTime = playingTime;
    }

    public BigDecimal getPlayerAvgScore() {
        return playerAvgScore;
    }

    public void setPlayerAvgScore(BigDecimal playerAvgScore) {
        this.playerAvgScore = playerAvgScore;
    }

    public Integer getSeason() {
        return season;
    }

    public void setSeason(Integer season) {
        this.season = season;
    }

    public Integer getSeasonNum() {
        return seasonNum;
    }

    public void setSeasonNum(Integer seasonNum) {
        this.seasonNum = seasonNum;
    }

    public String getPlayerTeam() {
        return playerTeam;
    }

    public void setPlayerTeam(String playerTeam) {
        this.playerTeam = playerTeam;
    }

    public String getPlayerPosition() {
        return playerPosition;
    }

    public void setPlayerPosition(String playerPosition) {
        this.playerPosition = playerPosition;
    }

    public BigDecimal getPlayerAvgReb() {
        return playerAvgReb;
    }

    public void setPlayerAvgReb(BigDecimal playerAvgReb) {
        this.playerAvgReb = playerAvgReb;
    }

    public BigDecimal getPlayerAvgAss() {
        return playerAvgAss;
    }

    public void setPlayerAvgAss(BigDecimal playerAvgAss) {
        this.playerAvgAss = playerAvgAss;
    }

    public BigDecimal getPlayerAccuracy() {
        return playerAccuracy;
    }

    public void setPlayerAccuracy(BigDecimal playerAccuracy) {
        this.playerAccuracy = playerAccuracy;
    }

    public BigDecimal getPlayerThreeAccuracy() {
        return playerThreeAccuracy;
    }

    public void setPlayerThreeAccuracy(BigDecimal playerThreeAccuracy) {
        this.playerThreeAccuracy = playerThreeAccuracy;
    }

    public BigDecimal getPlayerAvgBlock() {
        return playerAvgBlock;
    }

    public void setPlayerAvgBlock(BigDecimal playerAvgBlock) {
        this.playerAvgBlock = playerAvgBlock;
    }

    public BigDecimal getPlayerAvgSteal() {
        return playerAvgSteal;
    }

    public void setPlayerAvgSteal(BigDecimal playerAvgSteal) {
        this.playerAvgSteal = playerAvgSteal;
    }

    public BigDecimal getPlayerAvgTurnover() {
        return playerAvgTurnover;
    }

    public void setPlayerAvgTurnover(BigDecimal playerAvgTurnover) {
        this.playerAvgTurnover = playerAvgTurnover;
    }

    public BigDecimal getPlayerPer() {
        return playerPer;
    }

    public void setPlayerPer(BigDecimal playerPer) {
        this.playerPer = playerPer;
    }

    public BigDecimal getPlayerPie() {
        return playerPie;
    }

    public void setPlayerPie(BigDecimal playerPie) {
        this.playerPie = playerPie;
    }

    public BigDecimal getPlayerWs() {
        return playerWs;
    }

    public void setPlayerWs(BigDecimal playerWs) {
        this.playerWs = playerWs;
    }

    public BigDecimal getPlayerOffEff() {
        return playerOffEff;
    }

    public void setPlayerOffEff(BigDecimal playerOffEff) {
        this.playerOffEff = playerOffEff;
    }

    public BigDecimal getPlayerDefEff() {
        return playerDefEff;
    }

    public void setPlayerDefEff(BigDecimal playerDefEff) {
        this.playerDefEff = playerDefEff;
    }

    public BigDecimal getPlayerNetEff() {
        return playerNetEff;
    }

    public void setPlayerNetEff(BigDecimal playerNetEff) {
        this.playerNetEff = playerNetEff;
    }

    public BigDecimal getPlayerAvgPn() {
        return playerAvgPn;
    }

    public void setPlayerAvgPn(BigDecimal playerAvgPn) {
        this.playerAvgPn = playerAvgPn;
    }

    public Integer getMvpRank() {
        return mvpRank;
    }

    public void setMvpRank(Integer mvpRank) {
        this.mvpRank = mvpRank;
    }

    public Integer getDpoyRank() {
        return dpoyRank;
    }

    public void setDpoyRank(Integer dpoyRank) {
        this.dpoyRank = dpoyRank;
    }

    public String getAllDbaTeam() {
        return allDbaTeam;
    }

    public void setAllDbaTeam(String allDbaTeam) {
        this.allDbaTeam = allDbaTeam;
    }

    public String getAllDefTeam() {
        return allDefTeam;
    }

    public void setAllDefTeam(String allDefTeam) {
        this.allDefTeam = allDefTeam;
    }

    public Integer getPlayerFrAppearance() {
        return playerFrAppearance;
    }

    public void setPlayerFrAppearance(Integer playerFrAppearance) {
        this.playerFrAppearance = playerFrAppearance;
    }

    public Integer getPlayerSrAppearance() {
        return playerSrAppearance;
    }

    public void setPlayerSrAppearance(Integer playerSrAppearance) {
        this.playerSrAppearance = playerSrAppearance;
    }

    public Integer getPlayerAppearance() {
        return playerAppearance;
    }

    public void setPlayerAppearance(Integer playerAppearance) {
        this.playerAppearance = playerAppearance;
    }

    public BigDecimal getPlayerFreethrowAccuracy() {
        return playerFreethrowAccuracy;
    }

    public void setPlayerFreethrowAccuracy(BigDecimal playerFreethrowAccuracy) {
        this.playerFreethrowAccuracy = playerFreethrowAccuracy;
    }
}