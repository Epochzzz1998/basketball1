package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * Skewer-work line of a wage record: NUM pieces of one kind, with name and unit price
 * snapshotted at entry time (TYPE_ID kept only as a soft reference for preselecting).
 */
@TableName("bbq_wage_skewer")
public class BbqWageSkewer extends Model<BbqWageSkewer> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "ID", type = IdType.INPUT)
    private String id;

    @TableField("RECORD_ID")
    private String recordId;

    @TableField("TYPE_ID")
    private String typeId;

    @TableField("NAME_SNAP")
    private String nameSnap;

    @TableField("PRICE_SNAP")
    private BigDecimal priceSnap;

    @TableField("NUM")
    private Integer num;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRecordId() {
        return recordId;
    }

    public void setRecordId(String recordId) {
        this.recordId = recordId;
    }

    public String getTypeId() {
        return typeId;
    }

    public void setTypeId(String typeId) {
        this.typeId = typeId;
    }

    public String getNameSnap() {
        return nameSnap;
    }

    public void setNameSnap(String nameSnap) {
        this.nameSnap = nameSnap;
    }

    public BigDecimal getPriceSnap() {
        return priceSnap;
    }

    public void setPriceSnap(BigDecimal priceSnap) {
        this.priceSnap = priceSnap;
    }

    public Integer getNum() {
        return num;
    }

    public void setNum(Integer num) {
        this.num = num;
    }
}
