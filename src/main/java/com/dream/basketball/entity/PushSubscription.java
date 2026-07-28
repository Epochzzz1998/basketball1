package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 一台设备的 Web Push 订阅。
 *
 * 浏览器调 pushManager.subscribe() 之后拿到三样东西：endpoint（推送服务给的投递地址）、
 * p256dh（设备公钥）、auth（认证密钥）。后两个是用来**加密载荷**的——推送服务只负责转发，
 * 看不懂内容，所以内容必须在我们这边就用设备的公钥加密好。
 *
 * 一个人可以有多条：手机一条、平板一条、桌面浏览器一条。按 endpoint 唯一，
 * 同一台设备重复订阅覆盖而不是堆积。
 */
@TableName("push_subscription")
public class PushSubscription extends Model<PushSubscription> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId("SUB_ID")
    private String subId;

    @TableField("USER_ID")
    private String userId;

    @TableField("ENDPOINT")
    private String endpoint;

    @TableField("P256DH")
    private String p256dh;

    @TableField("AUTH")
    private String auth;

    @TableField("USER_AGENT")
    private String userAgent;

    @TableField("CREATE_TIME")
    private Date createTime;

    /** 最近一次推送成功的时间。推送失败并不立刻删订阅（可能只是设备离线），看这个字段判断是不是真死了。 */
    @TableField("LAST_OK")
    private Date lastOk;

    public String getSubId() {
        return subId;
    }

    public void setSubId(String subId) {
        this.subId = subId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public String getP256dh() {
        return p256dh;
    }

    public void setP256dh(String p256dh) {
        this.p256dh = p256dh;
    }

    public String getAuth() {
        return auth;
    }

    public void setAuth(String auth) {
        this.auth = auth;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

    public Date getLastOk() {
        return lastOk;
    }

    public void setLastOk(Date lastOk) {
        this.lastOk = lastOk;
    }
}
