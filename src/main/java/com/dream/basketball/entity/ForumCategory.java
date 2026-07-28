package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 专题类别（全站一份，超管维护）：百家说首页按它筛专题。
 *
 * 专题存的是 CATEGORY_ID 而不是类别名——改名只动这一行，所有专题跟着变；
 * 帖子的类别是另一套（各专题自己配，存在 forum_topic.POST_CATEGORIES 里）。
 */
@TableName("forum_category")
public class ForumCategory extends Model<ForumCategory> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "CATEGORY_ID", type = IdType.INPUT)
    private String categoryId;

    @TableField("NAME")
    private String name;

    /** 展示顺序，小的在前；同序按创建时间。 */
    @TableField("SORT")
    private Integer sort;

    @TableField("CREATE_TIME")
    private Date createTime;

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getSort() {
        return sort;
    }

    public void setSort(Integer sort) {
        this.sort = sort;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
}
