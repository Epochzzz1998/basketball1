package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 一台**原生 App** 的推送目标（FCM）。
 *
 * <p>和 {@link PushSubscription}（Web Push）刻意分成两张表，因为两者不是一回事：
 * Web Push 存的是 endpoint + 两把加密密钥（载荷要在我们这边加密，推送服务看不懂内容），
 * FCM 存的只是一个注册令牌（加密由 Google 那边负责）。硬塞进一张表会得到一半列永远是空的。
 *
 * <p>一个人可以有多条：手机一条、平板一条。按 TOKEN 唯一——同一台设备重装 App 会拿到
 * 新令牌，旧的那条由发送失败时清理（见 FcmSender 对 404/400 的处理）。
 */
@TableName("push_device")
public class PushDevice extends Model<PushDevice> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId("DEVICE_ID")
    private String deviceId;

    @TableField("USER_ID")
    private String userId;

    /** FCM 注册令牌。**会变**：App 重装、清数据、Google 主动轮换时都会换一个 */
    @TableField("TOKEN")
    private String token;

    /** 'android' | 'ios'。现在只有安卓在用，留着是因为 iOS 走 APNs 时同样要区分 */
    @TableField("PLATFORM")
    private String platform;

    @TableField("CREATE_TIME")
    private Date createTime;

    /** 最后一次成功送达。null = 从来没送达过，用来看一个令牌是不是从一开始就是坏的 */
    @TableField("LAST_OK")
    private Date lastOk;

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
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
