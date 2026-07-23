package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * A like on a person ON ONE BOARD of the Burning! leaderboards (unique TARGET+LIKER+BOARD,
 * toggle semantics) — liking someone on 工时榜 must not light their heart on the other boards.
 */
@TableName("burning_like")
public class BurningLike extends Model<BurningLike> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "ID", type = IdType.INPUT)
    private String id;

    @TableField("TARGET_ID")
    private String targetId;

    @TableField("LIKER_ID")
    private String likerId;

    /** 'hours' | 'skewers' | 'latestOff' | 'days' */
    @TableField("BOARD")
    private String board;

    @TableField("CREATE_TIME")
    private Date createTime;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public String getLikerId() {
        return likerId;
    }

    public void setLikerId(String likerId) {
        this.likerId = likerId;
    }

    public String getBoard() {
        return board;
    }

    public void setBoard(String board) {
        this.board = board;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
}
