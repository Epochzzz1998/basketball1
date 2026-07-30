package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 一场对局的公共信息 + 原始 JSON。
 *
 * <p><b>对局详情是不变的</b>：打完之后 Riot 那边不会再改，所以抓一次存永久、绝不重抓。
 * 这让本地库成为唯一真相，API 只用在最前沿那一小段——而这正是「20 个人一分钟刷 60 次榜单
 * 却一次 Riot 请求都不产生」的原因。
 *
 * <p><b>RAW_GZ 为什么值得存</b>：一场原文约 128KB，gzip 后只有 10KB 出头，一年也才几十兆。
 * 换来两件事：以后想加任何新指标都不用重抓（而 Riot 的对局历史有保留期，过期就再也拿不到）；
 * 以及有人**晚绑定**时，他过去那些已经因为队友而入库的对局，可以直接从这里解出他那一行，
 * 一次 API 都不用调。
 */
@TableName("lol_match")
public class LolMatch extends Model<LolMatch> implements Serializable {
    private static final long serialVersionUID = 1L;

    /** 形如 OC1_1234567890。前缀是平台值（oc1）不是区域值（sea） */
    @TableId("MATCH_ID")
    private String matchId;

    @TableField("PLATFORM")
    private String platform;

    /** 400=匹配征召 420=单双排 430=盲选 440=灵活 450=大乱斗 */
    @TableField("QUEUE_ID")
    private Integer queueId;

    @TableField("GAME_MODE")
    private String gameMode;

    @TableField("GAME_START")
    private Date gameStart;

    /** 秒 */
    @TableField("GAME_DURATION")
    private Integer gameDuration;

    @TableField("GAME_VERSION")
    private String gameVersion;

    /** GameComplete / Abort_*。非 Complete 的不该进榜 */
    @TableField("END_RESULT")
    private String endResult;

    /** match-v5 详情原文的 gzip */
    @TableField("RAW_GZ")
    private byte[] rawGz;

    @TableField("CREATE_TIME")
    private Date createTime;

    public String getMatchId() {
        return matchId;
    }

    public void setMatchId(String matchId) {
        this.matchId = matchId;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public Integer getQueueId() {
        return queueId;
    }

    public void setQueueId(Integer queueId) {
        this.queueId = queueId;
    }

    public String getGameMode() {
        return gameMode;
    }

    public void setGameMode(String gameMode) {
        this.gameMode = gameMode;
    }

    public Date getGameStart() {
        return gameStart;
    }

    public void setGameStart(Date gameStart) {
        this.gameStart = gameStart;
    }

    public Integer getGameDuration() {
        return gameDuration;
    }

    public void setGameDuration(Integer gameDuration) {
        this.gameDuration = gameDuration;
    }

    public String getGameVersion() {
        return gameVersion;
    }

    public void setGameVersion(String gameVersion) {
        this.gameVersion = gameVersion;
    }

    public String getEndResult() {
        return endResult;
    }

    public void setEndResult(String endResult) {
        this.endResult = endResult;
    }

    public byte[] getRawGz() {
        return rawGz;
    }

    public void setRawGz(byte[] rawGz) {
        this.rawGz = rawGz;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

}