package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 站内用户 ←→ Riot 账号的绑定。
 *
 * <p><b>为什么必须有这张表，而不是直接按 Riot ID 查</b>：Riot 的公开 API 本来就能查任何人
 * （只要知道 gameName#tagLine，不需要对方授权），所以绑定不是技术上的必需。
 * 它解决的是另外两件事——一是把游戏账号对应到**站内哪个用户**，否则榜上显示的是一串
 * 陌生 ID 而不是站内昵称；二是「绑定」这个动作本身就是当事人的同意，
 * 而这个模块要出「谁在的时候队伍胜率最低」这类榜，没有同意会出事。
 *
 * <p>一个人可以绑多个号（小号），所以 USER_ID 不唯一；PUUID 唯一，
 * 一个游戏账号不允许被两个站内用户同时认领。
 */
@TableName("lol_account")
public class LolAccount extends Model<LolAccount> implements Serializable {
    private static final long serialVersionUID = 1L;

    /** uuid */
    @TableId("ACCOUNT_ID")
    private String accountId;

    /** dream_user.USER_ID；一个人可绑多个小号，所以这里不唯一 */
    @TableField("USER_ID")
    private String userId;

    /** Riot ID 的前半段 */
    @TableField("GAME_NAME")
    private String gameName;

    /** Riot ID 的后半段（# 之后） */
    @TableField("TAG_LINE")
    private String tagLine;

    /** 抓取全靠它。绑定时解析一次，之后永不再调 account-v1 */
    @TableField("PUUID")
    private String puuid;

    /** oc1 / tw2…；决定 league-v4 打哪个主机 */
    @TableField("PLATFORM")
    private String platform;

    /** match-v5 的区域路由。澳服是 sea，写成 asia 拿不到对局 */
    @TableField("REGION")
    private String region;

    /** '0' = 暂停抓取但保留已有数据 */
    @TableField("ENABLED")
    private String enabled;

    /** '0' = 首次回填还没跑完，调度器会来补历史 */
    @TableField("BACKFILLED")
    private String backfilled;

    /** 当前段位 IRON…CHALLENGER。只给**已绑定成员**存——路人的段位要逐个 PUUID 查，
     * 而库里两百多场对局里的不重复路人有两千多个，填满要花掉大量配额去换一堆没人关心的名字 */
    @TableField("TIER")
    private String tier;

    /** I/II/III/IV。大师以上没有小段，这里是 null */
    @TableField("RANK_DIV")
    private String rankDiv;

    @TableField("LEAGUE_POINT")
    private Integer leaguePoint;

    @TableField("RANK_WINS")
    private Integer rankWins;

    @TableField("RANK_LOSSES")
    private Integer rankLosses;

    /** 上次刷新段位的时刻。调度器据此判断要不要再查，避免每轮都白打一次请求 */
    @TableField("RANK_UPDATED")
    private Date rankUpdated;

    @TableField("BIND_TIME")
    private Date bindTime;

    /** 最后一次成功拉到对局列表的时刻 */
    @TableField("LAST_SYNC")
    private Date lastSync;

    /** 最后一次失败原因。抓取一旦静默停摆，这里是唯一线索 */
    @TableField("LAST_ERROR")
    private String lastError;

    public String getAccountId() {
        return accountId;
    }

    public void setAccountId(String accountId) {
        this.accountId = accountId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getGameName() {
        return gameName;
    }

    public void setGameName(String gameName) {
        this.gameName = gameName;
    }

    public String getTagLine() {
        return tagLine;
    }

    public void setTagLine(String tagLine) {
        this.tagLine = tagLine;
    }

    public String getPuuid() {
        return puuid;
    }

    public void setPuuid(String puuid) {
        this.puuid = puuid;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getEnabled() {
        return enabled;
    }

    public void setEnabled(String enabled) {
        this.enabled = enabled;
    }

    public String getBackfilled() {
        return backfilled;
    }

    public void setBackfilled(String backfilled) {
        this.backfilled = backfilled;
    }

    public Date getBindTime() {
        return bindTime;
    }

    public void setBindTime(Date bindTime) {
        this.bindTime = bindTime;
    }

    public Date getLastSync() {
        return lastSync;
    }

    public void setLastSync(Date lastSync) {
        this.lastSync = lastSync;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public String getTier() {
        return tier;
    }

    public void setTier(String tier) {
        this.tier = tier;
    }

    public String getRankDiv() {
        return rankDiv;
    }

    public void setRankDiv(String rankDiv) {
        this.rankDiv = rankDiv;
    }

    public Integer getLeaguePoint() {
        return leaguePoint;
    }

    public void setLeaguePoint(Integer leaguePoint) {
        this.leaguePoint = leaguePoint;
    }

    public Integer getRankWins() {
        return rankWins;
    }

    public void setRankWins(Integer rankWins) {
        this.rankWins = rankWins;
    }

    public Integer getRankLosses() {
        return rankLosses;
    }

    public void setRankLosses(Integer rankLosses) {
        this.rankLosses = rankLosses;
    }

    public Date getRankUpdated() {
        return rankUpdated;
    }

    public void setRankUpdated(Date rankUpdated) {
        this.rankUpdated = rankUpdated;
    }
}
