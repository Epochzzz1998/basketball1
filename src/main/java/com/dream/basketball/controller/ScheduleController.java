package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ScheduleEvent;
import com.dream.basketball.entity.UserFollow;
import com.dream.basketball.mapper.ScheduleEventMapper;
import com.dream.basketball.mapper.UserFollowMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;

/**
 * Personal schedule (日程表). Fully private: a calendar shows events the viewer created plus
 * events assigned to them — no one else's endpoint exists. Assignee must be the owner or one
 * of the owner's followers (checked fresh at assign time). Assignment notifies immediately;
 * the 8am same-day digest lives in ScheduleReminderJob.
 */
@RestController
@RequestMapping("/schedule")
public class ScheduleController {

    private static final int TITLE_MAX = 50;
    private static final int NOTE_MAX = 200;
    private static final int EVENTS_PER_DAY_MAX = 20;

    @Autowired
    private ScheduleEventMapper eventMapper;
    @Autowired
    private UserFollowMapper followMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private UserInformationService userInformationService;

    private boolean validDate(String d) {
        return d != null && d.matches("^\\d{4}-\\d{2}-\\d{2}$");
    }

    private boolean validTime(String t) {
        return t != null && t.matches("^([01]\\d|2[0-3]):[0-5]\\d$");
    }

    /** 负责人只能是自己或"关注我的人"（实时查关注表） */
    private boolean canAssign(String me, String assigneeId) {
        if (StringUtils.equals(me, assigneeId)) {
            return true;
        }
        return followMapper.selectCount(new QueryWrapper<UserFollow>()
                .eq("FOLLOWER_ID", assigneeId).eq("FOLLOWEE_ID", me)) > 0;
    }

    /** 某月的我的日历（我创建的 + 指派给我的），带创建者/负责人昵称头像。month 形如 2026-07；
     *  userInformationId 可选：从"我的消息"深链进来时带上，顺便标记该条消息已读（老套路）。 */
    @RequiresRole(Role.USER)
    @GetMapping("/month")
    public Object month(String month, String userInformationId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        userInformationService.updateInformationRead(userInformationId);
        if (month == null || !month.matches("^\\d{4}-\\d{2}$")) {
            return new Result<>(1, "月份格式应为 yyyy-MM", null);
        }
        // 与该月有交集的都要（跨天任务可能起止跨月）：EVENT_DATE<=月末 且 (END_DATE>=月初 或 无END_DATE且EVENT_DATE>=月初)
        String monthStart = month + "-01";
        String monthEnd = month + "-31";
        List<ScheduleEvent> events = eventMapper.selectList(new QueryWrapper<ScheduleEvent>()
                .le("EVENT_DATE", monthEnd)
                .and(w -> w.ge("END_DATE", monthStart).or(x -> x.isNull("END_DATE").ge("EVENT_DATE", monthStart)))
                .and(w -> w.eq("OWNER_ID", me.getUserId()).or().eq("ASSIGNEE_ID", me.getUserId()))
                .orderByAsc("EVENT_DATE", "EVENT_TIME", "CREATE_TIME"));
        // 批量取相关用户（创建者 + 负责人）的昵称/头像
        Set<String> uids = new HashSet<>();
        for (ScheduleEvent e : events) {
            uids.add(e.getOwnerId());
            if (StringUtils.isNotBlank(e.getAssigneeId())) {
                uids.add(e.getAssigneeId());
            }
        }
        Map<String, DreamUser> users = new HashMap<>();
        if (!uids.isEmpty()) {
            for (DreamUser u : userMapper.selectBatchIds(uids)) {
                users.put(u.getUserId(), u);
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (ScheduleEvent e : events) {
            Map<String, Object> m = new HashMap<>();
            m.put("eventId", e.getEventId());
            m.put("date", e.getEventDate());
            m.put("time", e.getEventTime());
            m.put("endDate", e.getEndDate());
            m.put("endTime", e.getEndTime());
            m.put("title", e.getTitle());
            m.put("note", e.getNote());
            m.put("done", "1".equals(e.getDone()));
            m.put("ownerId", e.getOwnerId());
            m.put("mine", StringUtils.equals(e.getOwnerId(), me.getUserId()));
            DreamUser owner = users.get(e.getOwnerId());
            m.put("ownerName", owner == null ? null : owner.getUserNickname());
            if (StringUtils.isNotBlank(e.getAssigneeId())) {
                m.put("assigneeId", e.getAssigneeId());
                DreamUser a = users.get(e.getAssigneeId());
                m.put("assigneeName", a == null ? e.getAssigneeId() : a.getUserNickname());
                m.put("assigneeAvatar", a == null ? null : a.getAvatar());
            }
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /** 负责人候选：我自己 + 关注我的人（带昵称/头像，供下拉）。 */
    @RequiresRole(Role.USER)
    @GetMapping("/assignees")
    public Object assignees(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, Object> self = new HashMap<>();
        self.put("userId", me.getUserId());
        self.put("userNickname", me.getUserNickname() + "（我自己）");
        self.put("avatar", me.getAvatar());
        out.add(self);
        List<String> followerIds = new ArrayList<>();
        for (UserFollow f : followMapper.selectList(new QueryWrapper<UserFollow>()
                .eq("FOLLOWEE_ID", me.getUserId()).last("limit 200"))) {
            followerIds.add(f.getFollowerId());
        }
        if (!followerIds.isEmpty()) {
            for (DreamUser u : userMapper.selectBatchIds(followerIds)) {
                Map<String, Object> m = new HashMap<>();
                m.put("userId", u.getUserId());
                m.put("userNickname", u.getUserNickname());
                m.put("avatar", u.getAvatar());
                out.add(m);
            }
        }
        return new Result<>(0, "成功", out);
    }

    /**
     * 建事件（自己的日历）：标题必填；时刻为可选**区间**（time~endTime）；
     * endDate=截止日期 → 跨天"截止任务"（区间左端=开始日的 time，右端=截止日的 endTime）；
     * 负责人可选（自己或关注我的人）；每天上限 20。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/create")
    public Object create(String date, String time, String endTime, String endDate, String title, String note,
                         String assigneeId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!validDate(date)) {
            return new Result<>(1, "日期格式应为 yyyy-MM-dd", null);
        }
        String t = StringUtils.trimToEmpty(title);
        if (t.isEmpty() || t.length() > TITLE_MAX) {
            return new Result<>(1, "标题需为 1-" + TITLE_MAX + " 字", null);
        }
        String n = StringUtils.trimToNull(note);
        if (n != null && n.length() > NOTE_MAX) {
            return new Result<>(1, "备注不能超过 " + NOTE_MAX + " 字", null);
        }
        String tm = StringUtils.trimToNull(time);
        if (tm != null && !validTime(tm)) {
            return new Result<>(1, "时间格式应为 HH:mm", null);
        }
        String etm = StringUtils.trimToNull(endTime);
        if (etm != null && !validTime(etm)) {
            return new Result<>(1, "结束时间格式应为 HH:mm", null);
        }
        String ed = StringUtils.trimToNull(endDate);
        if (ed != null) {
            if (!validDate(ed)) {
                return new Result<>(1, "截止日期格式应为 yyyy-MM-dd", null);
            }
            if (ed.compareTo(date) < 0) {
                return new Result<>(1, "截止日期不能早于开始日期", null);
            }
            if (ed.equals(date)) {
                ed = null; // 同一天=普通单日任务
            }
        }
        // 单日任务的时间区间要正着来
        if (ed == null && tm != null && etm != null && etm.compareTo(tm) <= 0) {
            return new Result<>(1, "结束时间要晚于开始时间", null);
        }
        String assignee = StringUtils.trimToNull(assigneeId);
        if (assignee != null) {
            if (userMapper.selectById(assignee) == null) {
                return new Result<>(1, "负责人不存在", null);
            }
            if (!canAssign(me.getUserId(), assignee)) {
                return new Result<>(1, "负责人只能是你自己或关注你的人", null);
            }
        }
        Integer already = eventMapper.selectCount(new QueryWrapper<ScheduleEvent>()
                .eq("OWNER_ID", me.getUserId()).eq("EVENT_DATE", date));
        if (already != null && already >= EVENTS_PER_DAY_MAX) {
            return new Result<>(1, "一天最多安排 " + EVENTS_PER_DAY_MAX + " 个事件", null);
        }
        ScheduleEvent e = new ScheduleEvent();
        e.setEventId(UUID.randomUUID().toString());
        e.setOwnerId(me.getUserId());
        e.setEventDate(date);
        e.setEventTime(tm);
        e.setEndDate(ed);
        e.setEndTime(etm);
        e.setTitle(t);
        e.setNote(n);
        e.setAssigneeId(assignee);
        e.setCreateTime(new Date());
        eventMapper.insert(e);
        // 指派立即通知（指派给自己不打扰——saveUserInformation 的自操作守卫会拦，但这里显式判掉更清晰）
        if (assignee != null && !StringUtils.equals(assignee, me.getUserId())) {
            String when = date + (tm == null ? "" : " " + tm);
            if (ed != null) {
                when += " → 截止 " + ed + (etm == null ? "" : " " + etm);
            } else if (etm != null) {
                when += "-" + etm;
            }
            userInformationService.saveUserInformation(me.getUserId(), me.getUserNickname(), assignee,
                    Constants.SCHEDULE_ASSIGN, e.getEventId(), date, "", "",
                    t + "（" + when + "）", "");
        }
        return new Result<>(0, "已添加", e.getEventId());
    }

    /** 标记完成/取消完成（创建者或负责人）。 */
    @RequiresRole(Role.USER)
    @PostMapping("/toggleDone")
    public Object toggleDone(String eventId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ScheduleEvent e = StringUtils.isBlank(eventId) ? null : eventMapper.selectById(eventId);
        if (e == null) {
            return new Result<>(1, "事件不存在", null);
        }
        if (!StringUtils.equals(e.getOwnerId(), me.getUserId())
                && !StringUtils.equals(e.getAssigneeId(), me.getUserId())) {
            return new Result<>(1, "只有创建者或负责人可以操作", null);
        }
        boolean nowDone = !"1".equals(e.getDone());
        e.setDone(nowDone ? "1" : null);
        eventMapper.updateById(e);
        return new Result<>(0, nowDone ? "已完成" : "已取消完成", nowDone);
    }

    /** 删事件（创建者或超管）。 */
    @RequiresRole(Role.USER)
    @PostMapping("/delete")
    public Object delete(String eventId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ScheduleEvent e = StringUtils.isBlank(eventId) ? null : eventMapper.selectById(eventId);
        if (e == null) {
            return new Result<>(1, "事件不存在", null);
        }
        boolean isSuper = Role.fromUserRole(me.getUserRole()) == Role.SUPER_MANAGER;
        if (!isSuper && !StringUtils.equals(e.getOwnerId(), me.getUserId())) {
            return new Result<>(1, "只有创建者可以删除", null);
        }
        eventMapper.deleteById(eventId);
        return new Result<>(0, "已删除", null);
    }
}
