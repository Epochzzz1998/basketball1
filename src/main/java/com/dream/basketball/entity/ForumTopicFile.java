package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;

/**
 * 专题文件系统里的一个节点：文件夹或文件。
 *
 * <p>层级靠 {@code PARENT_ID} 自引用（NULL = 根目录），没有单独的目录表——
 * 文件夹和文件要在同一个列表里混排显示，拆两张表只会让每次列目录变成两次查询
 * 再手工合并。深度没有硬限制，防环由写入侧保证（新建只能挂在已存在的文件夹下，
 * 不提供"移动"，环就造不出来）。
 *
 * <p>{@code URL} 只有文件有，指向 /picImg/ 下的内容寻址文件（和评论附件同一套
 * 存储，见 FileUtils.store：同内容只落一份盘，文件名带盐算出，猜不到）。
 * {@code NAME} 是上传时的原始文件名，供显示和下载命名——寻址名是一串十六进制，
 * 直接拿它当显示名的话列表没法读。
 */
@TableName("forum_topic_file")
public class ForumTopicFile implements Serializable {
    private static final long serialVersionUID = 1L;

    public static final String KIND_FOLDER = "folder";
    public static final String KIND_FILE = "file";

    @TableId(value = "FILE_ID", type = IdType.INPUT)
    private String fileId;

    @TableField("TOPIC_ID")
    private String topicId;

    /** 所在文件夹；NULL = 根目录 */
    @TableField("PARENT_ID")
    private String parentId;

    /** folder | file */
    @TableField("KIND")
    private String kind;

    @TableField("NAME")
    private String name;

    @TableField("URL")
    private String url;

    @TableField("SIZE")
    private Long size;

    @TableField("UPLOADER_ID")
    private String uploaderId;

    @TableField("CREATE_TIME")
    private Date createTime;

    public String getFileId() {
        return fileId;
    }

    public void setFileId(String fileId) {
        this.fileId = fileId;
    }

    public String getTopicId() {
        return topicId;
    }

    public void setTopicId(String topicId) {
        this.topicId = topicId;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public Long getSize() {
        return size;
    }

    public void setSize(Long size) {
        this.size = size;
    }

    public String getUploaderId() {
        return uploaderId;
    }

    public void setUploaderId(String uploaderId) {
        this.uploaderId = uploaderId;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
}
