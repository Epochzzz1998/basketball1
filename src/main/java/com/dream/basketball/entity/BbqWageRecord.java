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
 * One employee's wage entry for one day (unique per USER_ID+WORK_DATE). END_TIME <= START_TIME
 * means the shift runs past midnight and is booked on the start date. TOTAL is always computed
 * server-side: hours*rate − (meal ? 15min*rate) − deduct + Σ skewer snapshots. SETTLE_ID set
 * means the record is settled and locked (batch 2).
 */
@TableName("bbq_wage_record")
public class BbqWageRecord extends Model<BbqWageRecord> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "RECORD_ID", type = IdType.INPUT)
    private String recordId;

    @TableField("USER_ID")
    private String userId;

    /** 'yyyy-MM-dd' */
    @TableField("WORK_DATE")
    private String workDate;

    /** 'HH:mm' */
    @TableField("START_TIME")
    private String startTime;

    /** 'HH:mm'; <= START_TIME means next day */
    @TableField("END_TIME")
    private String endTime;

    @TableField("HOURLY_RATE")
    private BigDecimal hourlyRate;

    /** '1' = ate at work → 15 minutes of pay deducted */
    @TableField("MEAL")
    private String meal;

    @TableField("DEDUCT")
    private BigDecimal deduct;

    @TableField("DEDUCT_REASON")
    private String deductReason;

    @TableField("SKEWER_PAY")
    private BigDecimal skewerPay;

    @TableField("TOTAL")
    private BigDecimal total;

    @TableField("SETTLE_ID")
    private String settleId;

    @TableField("CREATE_BY")
    private String createBy;

    @TableField("UPDATE_BY")
    private String updateBy;

    @TableField("CREATE_TIME")
    private Date createTime;

    @TableField("UPDATE_TIME")
    private Date updateTime;

    public String getRecordId() {
        return recordId;
    }

    public void setRecordId(String recordId) {
        this.recordId = recordId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getWorkDate() {
        return workDate;
    }

    public void setWorkDate(String workDate) {
        this.workDate = workDate;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public BigDecimal getHourlyRate() {
        return hourlyRate;
    }

    public void setHourlyRate(BigDecimal hourlyRate) {
        this.hourlyRate = hourlyRate;
    }

    public String getMeal() {
        return meal;
    }

    public void setMeal(String meal) {
        this.meal = meal;
    }

    public BigDecimal getDeduct() {
        return deduct;
    }

    public void setDeduct(BigDecimal deduct) {
        this.deduct = deduct;
    }

    public String getDeductReason() {
        return deductReason;
    }

    public void setDeductReason(String deductReason) {
        this.deductReason = deductReason;
    }

    public BigDecimal getSkewerPay() {
        return skewerPay;
    }

    public void setSkewerPay(BigDecimal skewerPay) {
        this.skewerPay = skewerPay;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public void setTotal(BigDecimal total) {
        this.total = total;
    }

    public String getSettleId() {
        return settleId;
    }

    public void setSettleId(String settleId) {
        this.settleId = settleId;
    }

    public String getCreateBy() {
        return createBy;
    }

    public void setCreateBy(String createBy) {
        this.createBy = createBy;
    }

    public String getUpdateBy() {
        return updateBy;
    }

    public void setUpdateBy(String updateBy) {
        this.updateBy = updateBy;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

    public Date getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(Date updateTime) {
        this.updateTime = updateTime;
    }
}
