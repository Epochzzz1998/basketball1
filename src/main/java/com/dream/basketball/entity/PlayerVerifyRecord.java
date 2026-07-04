package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/** Player identity verification review record (history log for the admin review page). */
@TableName("player_verify_record")
public class PlayerVerifyRecord extends Model<PlayerVerifyRecord> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "ID", type = IdType.INPUT)
    private String id;

    @TableField("USER_ID")
    private String userId;

    @TableField("PLAYER_ID")
    private String playerId;

    /** pending / approved / rejected / cancelled */
    @TableField("STATUS")
    private String status;

    @TableField("APPLY_TIME")
    private Date applyTime;

    @TableField("HANDLE_TIME")
    private Date handleTime;

    @TableField("HANDLER_ID")
    private String handlerId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Date getApplyTime() { return applyTime; }
    public void setApplyTime(Date applyTime) { this.applyTime = applyTime; }
    public Date getHandleTime() { return handleTime; }
    public void setHandleTime(Date handleTime) { this.handleTime = handleTime; }
    public String getHandlerId() { return handlerId; }
    public void setHandlerId(String handlerId) { this.handlerId = handlerId; }
}
