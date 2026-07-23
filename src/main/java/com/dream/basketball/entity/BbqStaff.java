package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * Membership of the (single, hardcoded) BBQ shop. One row per member; STAFF_ROLE 'manager'
 * shares full control of all books, 'staff' is read-only over their own wages. Managers are
 * appointed by the super admin (anyone) or promoted from existing staff by a manager; only
 * the super admin can demote a manager. Adding staff is gated on "target follows the adder".
 */
@TableName("bbq_staff")
public class BbqStaff extends Model<BbqStaff> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "USER_ID", type = IdType.INPUT)
    private String userId;

    /** 'manager' | 'staff' */
    @TableField("STAFF_ROLE")
    private String staffRole;

    @TableField("ADDED_BY")
    private String addedBy;

    @TableField("ADD_TIME")
    private Date addTime;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getStaffRole() {
        return staffRole;
    }

    public void setStaffRole(String staffRole) {
        this.staffRole = staffRole;
    }

    public String getAddedBy() {
        return addedBy;
    }

    public void setAddedBy(String addedBy) {
        this.addedBy = addedBy;
    }

    public Date getAddTime() {
        return addTime;
    }

    public void setAddTime(Date addTime) {
        this.addTime = addTime;
    }
}
