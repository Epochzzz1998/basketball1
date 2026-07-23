package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

/**
 * One settlement receipt for one employee: all their unsettled wage records up to the day
 * of settling get stamped with this SETTLE_ID (and become read-only). One settle action
 * over N employees produces N receipts.
 */
@TableName("bbq_settlement")
public class BbqSettlement extends Model<BbqSettlement> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "SETTLE_ID", type = IdType.INPUT)
    private String settleId;

    @TableField("USER_ID")
    private String userId;

    @TableField("FROM_DATE")
    private String fromDate;

    @TableField("TO_DATE")
    private String toDate;

    @TableField("AMOUNT")
    private BigDecimal amount;

    @TableField("RECORD_COUNT")
    private Integer recordCount;

    @TableField("SETTLED_BY")
    private String settledBy;

    @TableField("SETTLE_TIME")
    private Date settleTime;

    public String getSettleId() {
        return settleId;
    }

    public void setSettleId(String settleId) {
        this.settleId = settleId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getFromDate() {
        return fromDate;
    }

    public void setFromDate(String fromDate) {
        this.fromDate = fromDate;
    }

    public String getToDate() {
        return toDate;
    }

    public void setToDate(String toDate) {
        this.toDate = toDate;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public Integer getRecordCount() {
        return recordCount;
    }

    public void setRecordCount(Integer recordCount) {
        this.recordCount = recordCount;
    }

    public String getSettledBy() {
        return settledBy;
    }

    public void setSettledBy(String settledBy) {
        this.settledBy = settledBy;
    }

    public Date getSettleTime() {
        return settleTime;
    }

    public void setSettleTime(Date settleTime) {
        this.settleTime = settleTime;
    }
}
