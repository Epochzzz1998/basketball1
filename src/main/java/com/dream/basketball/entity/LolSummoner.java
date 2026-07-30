package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 对局里出现过的**所有人**（含路人）及其当前段位。
 *
 * <p>为什么不塞进 {@link LolMatchPlayer}：那张表按设计只存自己人，
 * 而段位要给一场里全部十个人显示。而且段位是「这个召唤师当前的属性」，
 * 和某一场对局无关——同一个人出现在二十场里，段位只该有一份。
 *
 * <p>为什么不现场去查：一次详情十个人 = 十次 API 调用，占两分钟配额的 10%，
 * 几个人随手点几下就打满了。所以改成后台按 {@code LAST_SEEN} 倒序慢慢填，页面只读库——
 * 最近见过的人先补，因为那才是有人会去看的。
 */
@TableName("lol_summoner")
public class LolSummoner extends Model<LolSummoner> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId("PUUID")
    private String puuid;

    @TableField("GAME_NAME")
    private String gameName;

    @TableField("TAG_LINE")
    private String tagLine;

    /** 当前 API key 下的 PUUID，只用于调接口。见 LolAccount 里的说明 */
    @TableField("API_PUUID")
    private String apiPuuid;

    @TableField("PLATFORM")
    private String platform;

    @TableField("TIER")
    private String tier;

    @TableField("RANK_DIV")
    private String rankDiv;

    @TableField("LEAGUE_POINT")
    private Integer leaguePoint;

    /** null = 还没查过，调度器优先补这些 */
    @TableField("RANK_UPDATED")
    private Date rankUpdated;

    /** 最近一次出现在对局里 */
    @TableField("LAST_SEEN")
    private Date lastSeen;

    public String getPuuid() {
        return puuid;
    }

    public void setPuuid(String puuid) {
        this.puuid = puuid;
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

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
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

    public Date getRankUpdated() {
        return rankUpdated;
    }

    public void setRankUpdated(Date rankUpdated) {
        this.rankUpdated = rankUpdated;
    }

    public Date getLastSeen() {
        return lastSeen;
    }

    public void setLastSeen(Date lastSeen) {
        this.lastSeen = lastSeen;
    }

    public String getApiPuuid() {
        return apiPuuid;
    }

    public void setApiPuuid(String apiPuuid) {
        this.apiPuuid = apiPuuid;
    }
}
