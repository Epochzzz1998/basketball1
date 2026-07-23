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
 * A skewer kind with its current per-piece price (AUD). Wage records copy name+price into
 * snapshots at entry time, so renaming/repricing/deleting a type never rewrites old books.
 */
@TableName("bbq_skewer_type")
public class BbqSkewerType extends Model<BbqSkewerType> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "TYPE_ID", type = IdType.INPUT)
    private String typeId;

    @TableField("NAME")
    private String name;

    @TableField("UNIT_PRICE")
    private BigDecimal unitPrice;

    @TableField("CREATE_TIME")
    private Date createTime;

    public String getTypeId() {
        return typeId;
    }

    public void setTypeId(String typeId) {
        this.typeId = typeId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
}
