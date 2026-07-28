package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 全站滚动公告。**只有一行**（ID 固定为 'default'），超管改的就是这一行。
 *
 * 不做成"多条公告 + 生效时间"的表，是因为需求就是"页面顶上滚一条提醒"；
 * 真要发第二条，直接把这行内容换掉即可。
 */
@TableName("site_announcement")
public class SiteAnnouncement extends Model<SiteAnnouncement> implements Serializable {
    private static final long serialVersionUID = 1L;

    /** 固定值，见类注释 */
    public static final String ONLY_ID = "default";

    @TableId(value = "ID", type = IdType.INPUT)
    private String id;

    @TableField("CONTENT")
    private String content;

    @TableField("ENABLED")
    private String enabled;

    /** info | warning | error，决定公告条的配色 */
    @TableField("LEVEL")
    private String level;

    /**
     * 最后修改时间。它同时充当**版本号**：前端把"我关掉的是哪一版"记在 localStorage 里，
     * 超管一改内容、版本就变，之前关掉过的人会重新看到——否则新公告发出去等于没发。
     */
    @TableField("UPDATE_TIME")
    private Date updateTime;

    @TableField("UPDATE_BY")
    private String updateBy;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getEnabled() { return enabled; }
    public void setEnabled(String enabled) { this.enabled = enabled; }
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
    public String getUpdateBy() { return updateBy; }
    public void setUpdateBy(String updateBy) { this.updateBy = updateBy; }
}
