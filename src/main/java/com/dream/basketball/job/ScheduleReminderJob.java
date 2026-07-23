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
 * 8am (Melbourne) daily digest: for each assignee, one message listing today's schedule events
 * they are responsible for (skipping done ones). REMINDED='1' keeps the job idempotent —
 * a same-day restart won't re-send.
 */
@Component
public class ScheduleReminderJob {

    @Autowired
    private ScheduleEventMapper eventMapper;

    @Autowired
    private UserInformationService userInformationService;

    @Scheduled(cron = "0 0 8 * * ?", zone = "Australia/Melbourne")
    public void remindToday() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd");
        fmt.setTimeZone(TimeZone.getTimeZone("Australia/Melbourne"));
        String today = fmt.format(new Date());
        List<ScheduleEvent> events = eventMapper.selectList(new QueryWrapper<ScheduleEvent>()
                .eq("EVENT_DATE", today)
                .isNotNull("ASSIGNEE_ID")
                .and(w -> w.isNull("DONE").or().ne("DONE", "1"))
                .and(w -> w.isNull("REMINDED").or().ne("REMINDED", "1"))
                .orderByAsc("EVENT_TIME", "CREATE_TIME"));
        if (events.isEmpty()) {
            return;
        }
        // 按负责人汇总成一条（全天事件在前，带时刻的按时间排）
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
                if (StringUtils.isNotBlank(e.getEventTime())) {
                    digest.append(e.getEventTime()).append(" ");
                }
                digest.append("「").append(e.getTitle()).append("」");
            }
            String text = "你今天负责 " + entry.getValue().size() + " 件事：" + digest;
            if (text.length() > 240) {
                text = text.substring(0, 240) + "…";
            }
            // operator 留空（系统消息）：不会命中"自己操作自己不提示"的守卫，自己指派给自己的也能收到
            userInformationService.saveUserInformation("", "日程提醒", entry.getKey(),
                    Constants.SCHEDULE_REMIND, today, "", "", "", text, "");
        }
        List<String> ids = new ArrayList<>();
        for (ScheduleEvent e : events) {
            ids.add(e.getEventId());
        }
        eventMapper.update(null, new UpdateWrapper<ScheduleEvent>().in("EVENT_ID", ids).set("REMINDED", "1"));
    }
}
