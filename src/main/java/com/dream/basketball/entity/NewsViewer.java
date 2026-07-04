package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;

import java.util.Date;

/** Unique post viewer (NEWS_ID + VIEWER_ID composite key) — powers UV dedup. */
@TableName("news_viewer")
public class NewsViewer {
    @TableField("NEWS_ID")
    private String newsId;
    @TableField("VIEWER_ID")
    private String viewerId;
    @TableField("VIEW_TIME")
    private Date viewTime;

    public String getNewsId() { return newsId; }
    public void setNewsId(String newsId) { this.newsId = newsId; }
    public String getViewerId() { return viewerId; }
    public void setViewerId(String viewerId) { this.viewerId = viewerId; }
    public Date getViewTime() { return viewTime; }
    public void setViewTime(Date viewTime) { this.viewTime = viewTime; }
}
