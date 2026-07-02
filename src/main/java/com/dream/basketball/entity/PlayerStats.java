package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;

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
public class PlayerStats extends Model<PlayerStats> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "STATS_ID", type = IdType.INPUT)
    private String statsId;

    @TableField("PLAYER_ID")
    private String playerId;

    @TableField("SEASON")
    private Integer season;

    @TableField("PLAYING_TIME")
    private BigDecimal playingTime;

    @TableField("PLAYER_AVG_SCORE")
    private BigDecimal playerAvgScore;

    @TableField("SEASON_NUM")
    private Integer seasonNum;

    @TableField("PLAYER_TEAM")
    private String playerTeam;

    @TableField("PLAYER_POSITION")
    private String playerPosition;

    @TableField("PLAYER_AVG_REB")
    private BigDecimal playerAvgReb;

    @TableField("PLAYER_AVG_ASS")
    private BigDecimal playerAvgAss;

    @TableField("PLAYER_ACCURACY")
    private BigDecimal playerAccuracy;

    @TableField("PLAYER_THREE_ACCURACY")
    private BigDecimal playerThreeAccuracy;

    @TableField("PLAYER_FREETHROW_ACCURACY")
    private BigDecimal playerFreethrowAccuracy;

    /** Per-game field goals made / attempted (投篮命中/出手). */
    @TableField("PLAYER_AVG_FGM")
    private BigDecimal playerAvgFgm;

    @TableField("PLAYER_AVG_FGA")
    private BigDecimal playerAvgFga;

    /** Per-game three-pointers made / attempted (三分命中/出手). */
    @TableField("PLAYER_AVG_TPM")
    private BigDecimal playerAvgTpm;

    @TableField("PLAYER_AVG_TPA")
    private BigDecimal playerAvgTpa;

    /** Per-game free throws made / attempted (罚球命中/出手). */
    @TableField("PLAYER_AVG_FTM")
    private BigDecimal playerAvgFtm;

    @TableField("PLAYER_AVG_FTA")
    private BigDecimal playerAvgFta;

    /** Per-game offensive / defensive rebounds (前场/后场篮板). */
    @TableField("PLAYER_AVG_OFF_REB")
    private BigDecimal playerAvgOffReb;

    @TableField("PLAYER_AVG_DEF_REB")
    private BigDecimal playerAvgDefReb;

    @TableField("PLAYER_AVG_BLOCK")
    private BigDecimal playerAvgBlock;

    @TableField("PLAYER_AVG_STEAL")
    private BigDecimal playerAvgSteal;

    @TableField("PLAYER_AVG_TURNOVER")
    private BigDecimal playerAvgTurnover;

    @TableField("PLAYER_PER")
    private BigDecimal playerPer;

    @TableField("PLAYER_PIE")
    private BigDecimal playerPie;

    @TableField("PLAYER_WS")
    private BigDecimal playerWs;

    @TableField("PLAYER_OFF_EFF")
    private BigDecimal playerOffEff;

    @TableField("PLAYER_DEF_EFF")
    private BigDecimal playerDefEff;

    @TableField("PLAYER_NET_EFF")
    private BigDecimal playerNetEff;

    @TableField("PLAYER_AVG_PN")
    private BigDecimal playerAvgPn;

    @TableField("MVP_RANK")
    private Integer mvpRank;

    @TableField("DPOY_RANK")
    private Integer dpoyRank;

    @TableField("ALL_DBA_TEAM")
    private String allDbaTeam;

    @TableField("ALL_DEF_TEAM")
    private String allDefTeam;

    @TableField("PLAYER_FR_APPEARANCE")
    private Integer playerFrAppearance;

    @TableField("PLAYER_SR_APPEARANCE")
    private Integer playerSrAppearance;

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

    public BigDecimal getPlayerAvgFgm() {
        return playerAvgFgm;
    }

    public void setPlayerAvgFgm(BigDecimal playerAvgFgm) {
        this.playerAvgFgm = playerAvgFgm;
    }

    public BigDecimal getPlayerAvgFga() {
        return playerAvgFga;
    }

    public void setPlayerAvgFga(BigDecimal playerAvgFga) {
        this.playerAvgFga = playerAvgFga;
    }

    public BigDecimal getPlayerAvgTpm() {
        return playerAvgTpm;
    }

    public void setPlayerAvgTpm(BigDecimal playerAvgTpm) {
        this.playerAvgTpm = playerAvgTpm;
    }

    public BigDecimal getPlayerAvgTpa() {
        return playerAvgTpa;
    }

    public void setPlayerAvgTpa(BigDecimal playerAvgTpa) {
        this.playerAvgTpa = playerAvgTpa;
    }

    public BigDecimal getPlayerAvgFtm() {
        return playerAvgFtm;
    }

    public void setPlayerAvgFtm(BigDecimal playerAvgFtm) {
        this.playerAvgFtm = playerAvgFtm;
    }

    public BigDecimal getPlayerAvgFta() {
        return playerAvgFta;
    }

    public void setPlayerAvgFta(BigDecimal playerAvgFta) {
        this.playerAvgFta = playerAvgFta;
    }

    public BigDecimal getPlayerAvgOffReb() {
        return playerAvgOffReb;
    }

    public void setPlayerAvgOffReb(BigDecimal playerAvgOffReb) {
        this.playerAvgOffReb = playerAvgOffReb;
    }

    public BigDecimal getPlayerAvgDefReb() {
        return playerAvgDefReb;
    }

    public void setPlayerAvgDefReb(BigDecimal playerAvgDefReb) {
        this.playerAvgDefReb = playerAvgDefReb;
    }
}