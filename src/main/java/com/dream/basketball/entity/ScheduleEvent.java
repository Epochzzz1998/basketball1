package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * A personal-calendar event. Private to its owner; if an assignee is set the event also shows
 * on the assignee's calendar, they get an immediate notice plus an 8am same-day digest reminder.
 * EVENT_DATE/'yyyy-MM-dd' and EVENT_TIME/'HH:mm' are plain strings — no timezone games.
 */
@TableName("schedule_event")
public class ScheduleEvent extends Model<ScheduleEvent> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "EVENT_ID", type = IdType.INPUT)
    private String eventId;

    /** creator = calendar owner */
    @TableField("OWNER_ID")
    private String ownerId;

    @TableField("EVENT_DATE")
    private String eventDate;

    /** optional range-start 'HH:mm'; null = all-day / unspecified */
    @TableField("EVENT_TIME")
    private String eventTime;

    /** deadline date 'yyyy-MM-dd' for multi-day (截止) tasks; null = same-day task */
    @TableField("END_DATE")
    private String endDate;

    /** optional range-end 'HH:mm' — on END_DATE if set, else on EVENT_DATE */
    @TableField("END_TIME")
    private String endTime;

    /** '1' = the one-shot overtime notice has been sent */
    @TableField("OVERDUE_NOTIFIED")
    private String overdueNotified;

    /** recurrence: 'day' | 'week' (same weekday as EVENT_DATE) | null = one-off */
    @TableField("RECUR")
    private String recur;

    /** last day of the recurrence window (required when RECUR set; extendable) */
    @TableField("RECUR_END")
    private String recurEnd;

    /** '1' = the day-before "循环即将结束" notice has been sent (reset on extend) */
    @TableField("EXPIRY_NOTIFIED")
    private String expiryNotified;

    /** optional category: 工作/学习/课程/生活/娱乐 (whitelisted at create) */
    @TableField("CATEGORY")
    private String category;

    @TableField("TITLE")
    private String title;

    @TableField("NOTE")
    private String note;

    /** optional; must be the owner themselves or one of their followers at assign time */
    @TableField("ASSIGNEE_ID")
    private String assigneeId;

    /** '1' = done (owner or assignee toggles); done events skip the 8am reminder */
    @TableField("DONE")
    private String done;

    /** '1' = the 8am digest already covered this event (idempotency for the daily job) */
    @TableField("REMINDED")
    private String reminded;

    @TableField("CREATE_TIME")
    private Date createTime;

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public String getEventDate() {
        return eventDate;
    }

    public void setEventDate(String eventDate) {
        this.eventDate = eventDate;
    }

    public String getEventTime() {
        return eventTime;
    }

    public void setEventTime(String eventTime) {
        this.eventTime = eventTime;
    }

    public String getEndDate() {
        return endDate;
    }

    public void setEndDate(String endDate) {
        this.endDate = endDate;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public String getOverdueNotified() {
        return overdueNotified;
    }

    public void setOverdueNotified(String overdueNotified) {
        this.overdueNotified = overdueNotified;
    }

    public String getRecur() {
        return recur;
    }

    public void setRecur(String recur) {
        this.recur = recur;
    }

    public String getRecurEnd() {
        return recurEnd;
    }

    public void setRecurEnd(String recurEnd) {
        this.recurEnd = recurEnd;
    }

    public String getExpiryNotified() {
        return expiryNotified;
    }

    public void setExpiryNotified(String expiryNotified) {
        this.expiryNotified = expiryNotified;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getAssigneeId() {
        return assigneeId;
    }

    public void setAssigneeId(String assigneeId) {
        this.assigneeId = assigneeId;
    }

    public String getDone() {
        return done;
    }

    public void setDone(String done) {
        this.done = done;
    }

    public String getReminded() {
        return reminded;
    }

    public void setReminded(String reminded) {
        this.reminded = reminded;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
}
