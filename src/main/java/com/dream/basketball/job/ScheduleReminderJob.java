package com.dream.basketball.job;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.dream.basketball.entity.ScheduleEvent;
import com.dream.basketball.mapper.ScheduleEventMapper;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.Constants;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.text.SimpleDateFormat;
import java.util.*;

/**
 * Schedule job — ONE daily 8am run (Melbourne clock) doing two things:
 * - digest per assignee ("你今天负责 N 件事：…"): single-day tasks on their day,
 *   deadline (multi-day) tasks on their DEADLINE day; skips done; REMINDED='1' = idempotent.
 * - overtime notice: an event whose deadline moment (END_DATE||EVENT_DATE + END_TIME||23:59)
 *   has passed and is STILL not done at this 8am gets a one-shot 超时 message
 *   (mark done before the next 8am and no notice is ever sent). Assignee, else the owner.
 *   System messages use a blank operatorId so the self-op guard never eats them.
 */
@Component
public class ScheduleReminderJob {

    @Autowired
    private ScheduleEventMapper eventMapper;

    @Autowired
    private UserInformationService userInformationService;

    private String nowStr(String pattern) {
        SimpleDateFormat fmt = new SimpleDateFormat(pattern);
        fmt.setTimeZone(TimeZone.getTimeZone("Australia/Melbourne"));
        return fmt.format(new Date());
    }

    public void remindToday() {
        String today = nowStr("yyyy-MM-dd");
        // 单日任务在开始日提醒；截止任务在截止日提醒（那才是要命的日子）
        List<ScheduleEvent> events = eventMapper.selectList(new QueryWrapper<ScheduleEvent>()
                .isNotNull("ASSIGNEE_ID")
                .and(w -> w.isNull("DONE").or().ne("DONE", "1"))
                .and(w -> w.isNull("REMINDED").or().ne("REMINDED", "1"))
                .and(w -> w.eq("END_DATE", today).or(x -> x.isNull("END_DATE").eq("EVENT_DATE", today)))
                .orderByAsc("EVENT_TIME", "CREATE_TIME"));
        if (events.isEmpty()) {
            return;
        }
        Map<String, List<ScheduleEvent>> byAssignee = new LinkedHashMap<>();
        for (ScheduleEvent e : events) {
            byAssignee.computeIfAbsent(e.getAssigneeId(), (k) -> new ArrayList<>()).add(e);
        }
        for (Map.Entry<String, List<ScheduleEvent>> entry : byAssignee.entrySet()) {
            StringBuilder digest = new StringBuilder();
            for (ScheduleEvent e : entry.getValue()) {
                if (digest.length() > 0) {
                    digest.append("、");
                }
                if (StringUtils.isNotBlank(e.getEndDate())) {
                    // 截止任务：今天到期
                    digest.append("「").append(e.getTitle()).append("」")
                            .append("(今天").append(StringUtils.isBlank(e.getEndTime()) ? "" : " " + e.getEndTime()).append("截止)");
                } else {
                    if (StringUtils.isNotBlank(e.getEventTime())) {
                        digest.append(e.getEventTime());
                        if (StringUtils.isNotBlank(e.getEndTime())) {
                            digest.append("-").append(e.getEndTime());
                        }
                        digest.append(" ");
                    }
                    digest.append("「").append(e.getTitle()).append("」");
                }
            }
            String text = "你今天负责 " + entry.getValue().size() + " 件事：" + digest;
            if (text.length() > 240) {
                text = text.substring(0, 240) + "…";
            }
            userInformationService.saveUserInformation("", "日程提醒", entry.getKey(),
                    Constants.SCHEDULE_REMIND, today, "", "", "", text, "");
        }
        List<String> ids = new ArrayList<>();
        for (ScheduleEvent e : events) {
            ids.add(e.getEventId());
        }
        eventMapper.update(null, new UpdateWrapper<ScheduleEvent>().in("EVENT_ID", ids).set("REMINDED", "1"));
    }

    /** 每天 8 点先发当日摘要，再补超时通知（不再高频扫描：超时后到下一个早八点还没完成才提醒） */
    @Scheduled(cron = "0 0 8 * * ?", zone = "Australia/Melbourne")
    public void dailyRun() {
        remindToday();
        scanOverdue();
    }

    public void scanOverdue() {
        String today = nowStr("yyyy-MM-dd");
        String nowTime = nowStr("HH:mm");
        // 粗筛（未完成、未通知过、已开始）后在 Java 里精判截止时刻——表小，清晰优先
        List<ScheduleEvent> candidates = eventMapper.selectList(new QueryWrapper<ScheduleEvent>()
                .and(w -> w.isNull("DONE").or().ne("DONE", "1"))
                .and(w -> w.isNull("OVERDUE_NOTIFIED").or().ne("OVERDUE_NOTIFIED", "1"))
                .le("EVENT_DATE", today));
        if (candidates.isEmpty()) {
            return;
        }
        List<String> notified = new ArrayList<>();
        for (ScheduleEvent e : candidates) {
            String deadlineDate = StringUtils.isNotBlank(e.getEndDate()) ? e.getEndDate() : e.getEventDate();
            String deadlineTime = StringUtils.isNotBlank(e.getEndTime()) ? e.getEndTime() : "23:59";
            boolean overdue = deadlineDate.compareTo(today) < 0
                    || (deadlineDate.equals(today) && deadlineTime.compareTo(nowTime) < 0);
            if (!overdue) {
                continue;
            }
            String receiver = StringUtils.isNotBlank(e.getAssigneeId()) ? e.getAssigneeId() : e.getOwnerId();
            String text = "「" + e.getTitle() + "」已超时未完成（截止 " + deadlineDate
                    + (StringUtils.isBlank(e.getEndTime()) ? "" : " " + e.getEndTime()) + "）";
            userInformationService.saveUserInformation("", "日程提醒", receiver,
                    Constants.SCHEDULE_OVERDUE, deadlineDate, "", "", "", text, "");
            notified.add(e.getEventId());
        }
        if (!notified.isEmpty()) {
            eventMapper.update(null, new UpdateWrapper<ScheduleEvent>().in("EVENT_ID", notified).set("OVERDUE_NOTIFIED", "1"));
        }
    }
}
