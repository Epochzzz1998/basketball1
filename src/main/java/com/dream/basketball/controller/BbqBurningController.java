package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.BbqStaff;
import com.dream.basketball.entity.BbqWageRecord;
import com.dream.basketball.entity.BbqWageSkewer;
import com.dream.basketball.entity.BurningComment;
import com.dream.basketball.entity.BurningLike;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.BbqStaffMapper;
import com.dream.basketball.mapper.BbqWageRecordMapper;
import com.dream.basketball.mapper.BbqWageSkewerMapper;
import com.dream.basketball.mapper.BurningCommentMapper;
import com.dream.basketball.mapper.BurningLikeMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;

/**
 * Burning！ — the shop's fun leaderboards, visible to every member (店长+店员). Four boards over
 * a week or month window: paid work minutes (#1 = 劳模), skewer pieces (#1 = 串王), latest
 * off-work moment (overnight-aware), days on shift. People rows support likes (toggle,
 * global not per-period) and paginated comments (author or a manager may delete).
 * No money appears anywhere here — wages stay in the ledger.
 */
@RestController
@RequestMapping("/bbq/burning")
public class BbqBurningController {

    private static final int COMMENT_MAX = 200;
    private static final int PAGE_SIZE = 5;
    /** minutes of pay deducted when the worker ate — keep in sync with BbqController */
    private static final int MEAL_MINUTES = 15;

    @Autowired
    private BbqStaffMapper staffMapper;
    @Autowired
    private BbqWageRecordMapper wageMapper;
    @Autowired
    private BbqWageSkewerMapper wageSkewerMapper;
    @Autowired
    private BurningCommentMapper commentMapper;
    @Autowired
    private BurningLikeMapper likeMapper;
    @Autowired
    private UserMapper userMapper;

    private boolean validDate(String d) {
        return d != null && d.matches("^\\d{4}-\\d{2}-\\d{2}$");
    }

    private int toMinutes(String hhmm) {
        return Integer.parseInt(hhmm.substring(0, 2)) * 60 + Integer.parseInt(hhmm.substring(3));
    }

    /** any member of the shop (manager or staff) may watch the boards */
    private boolean isMember(DreamUser me) {
        BbqStaff s = staffMapper.selectById(me.getUserId());
        return s != null;
    }

    private boolean isManager(DreamUser me) {
        BbqStaff s = staffMapper.selectById(me.getUserId());
        return s != null && "manager".equals(s.getStaffRole());
    }

    /** 四张榜（店内成员）：month=yyyy-MM 或 from/to 区间（≤93 天）。 */
    @RequiresRole(Role.USER)
    @GetMapping("/board")
    public Object board(String month, String from, String to, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isMember(me)) {
            return new Result<>(1, "你不是店里的成员", null);
        }
        String rangeFrom;
        String rangeTo;
        if (validDate(from) && validDate(to)) {
            if (from.compareTo(to) > 0) {
                return new Result<>(1, "起止日期倒挂", null);
            }
            if (java.time.temporal.ChronoUnit.DAYS.between(
                    java.time.LocalDate.parse(from), java.time.LocalDate.parse(to)) > 93) {
                return new Result<>(1, "跨度最多 93 天", null);
            }
            rangeFrom = from;
            rangeTo = to;
        } else if (month != null && month.matches("^\\d{4}-\\d{2}$")) {
            rangeFrom = month + "-01";
            rangeTo = month + "-31";
        } else {
            return new Result<>(1, "需要月份（yyyy-MM）或起止日期", null);
        }
        List<BbqWageRecord> records = wageMapper.selectList(new QueryWrapper<BbqWageRecord>()
                .between("WORK_DATE", rangeFrom, rangeTo));
        Map<String, Integer> minutesByUser = new HashMap<>();
        Map<String, Set<String>> daysByUser = new HashMap<>();
        Map<String, Integer> latestOffByUser = new HashMap<>();
        List<String> recordIds = new ArrayList<>();
        Map<String, String> recordUser = new HashMap<>();
        for (BbqWageRecord r : records) {
            recordIds.add(r.getRecordId());
            recordUser.put(r.getRecordId(), r.getUserId());
            daysByUser.computeIfAbsent(r.getUserId(), (k) -> new HashSet<>()).add(r.getWorkDate());
            if (StringUtils.isNotBlank(r.getStartTime()) && StringUtils.isNotBlank(r.getEndTime())) {
                int start = toMinutes(r.getStartTime());
                int end = toMinutes(r.getEndTime());
                int off = end;
                int worked = end - start;
                if (worked <= 0) {
                    worked += 24 * 60;
                    off += 24 * 60; // finishing next day counts as 24h+ for "latest off work"
                }
                int paid = Math.max(0, worked - ("1".equals(r.getMeal()) ? MEAL_MINUTES : 0));
                minutesByUser.merge(r.getUserId(), paid, Integer::sum);
                latestOffByUser.merge(r.getUserId(), off, Integer::max);
            }
        }
        Map<String, Integer> skewersByUser = new HashMap<>();
        if (!recordIds.isEmpty()) {
            for (BbqWageSkewer w : wageSkewerMapper.selectList(new QueryWrapper<BbqWageSkewer>().in("RECORD_ID", recordIds))) {
                String uid = recordUser.get(w.getRecordId());
                if (uid != null) {
                    skewersByUser.merge(uid, w.getNum(), Integer::sum);
                }
            }
        }
        // resolve everyone appearing anywhere
        Set<String> uids = new HashSet<>();
        uids.addAll(daysByUser.keySet());
        Map<String, DreamUser> users = new HashMap<>();
        if (!uids.isEmpty()) {
            for (DreamUser u : userMapper.selectBatchIds(uids)) {
                users.put(u.getUserId(), u);
            }
        }
        Map<String, Object> out = new HashMap<>();
        out.put("hours", board(minutesByUser, users));
        out.put("skewers", board(skewersByUser, users));
        out.put("latestOff", board(latestOffByUser, users));
        Map<String, Integer> dayCounts = new HashMap<>();
        daysByUser.forEach((k, v) -> dayCounts.put(k, v.size()));
        out.put("days", board(dayCounts, users));
        // likes are per (person, board) — a heart lit on 工时榜 stays dark on the other boards.
        // keys are "board:targetId" composites; counts persist across periods
        Map<String, Integer> likeCounts = new HashMap<>();
        List<String> myLikes = new ArrayList<>();
        if (!uids.isEmpty()) {
            for (BurningLike l : likeMapper.selectList(new QueryWrapper<BurningLike>().in("TARGET_ID", uids))) {
                String key = l.getBoard() + ":" + l.getTargetId();
                likeCounts.merge(key, 1, Integer::sum);
                if (StringUtils.equals(l.getLikerId(), me.getUserId())) {
                    myLikes.add(key);
                }
            }
        }
        out.put("likes", likeCounts);
        out.put("myLikes", myLikes);
        out.put("manager", isManager(me));
        return new Result<>(0, "成功", out);
    }

    private List<Map<String, Object>> board(Map<String, Integer> valueByUser, Map<String, DreamUser> users) {
        List<Map<String, Object>> rows = new ArrayList<>();
        valueByUser.entrySet().stream()
                .filter((e) -> e.getValue() > 0)
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(50)
                .forEach((e) -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("userId", e.getKey());
                    DreamUser u = users.get(e.getKey());
                    m.put("userNickname", u == null ? e.getKey() : u.getUserNickname());
                    m.put("avatar", u == null ? null : u.getAvatar());
                    m.put("value", e.getValue());
                    rows.add(m);
                });
        return rows;
    }

    private static final Set<String> BOARDS = new HashSet<>(Arrays.asList("hours", "skewers", "latestOff", "days"));

    /** 点赞/取消（店内成员）：只赞"这张榜上的这个人"，其他榜互不影响；跨周期计数保留。 */
    @RequiresRole(Role.USER)
    @PostMapping("/like")
    public Object like(String targetId, String board, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isMember(me)) {
            return new Result<>(1, "你不是店里的成员", null);
        }
        if (StringUtils.isBlank(targetId) || userMapper.selectById(targetId) == null) {
            return new Result<>(1, "用户不存在", null);
        }
        if (board == null || !BOARDS.contains(board)) {
            return new Result<>(1, "榜单类型不合法", null);
        }
        QueryWrapper<BurningLike> qw = new QueryWrapper<BurningLike>()
                .eq("TARGET_ID", targetId).eq("LIKER_ID", me.getUserId()).eq("BOARD", board);
        boolean liked;
        if (likeMapper.selectCount(qw) > 0) {
            likeMapper.delete(qw);
            liked = false;
        } else {
            BurningLike l = new BurningLike();
            l.setId(UUID.randomUUID().toString());
            l.setTargetId(targetId);
            l.setLikerId(me.getUserId());
            l.setBoard(board);
            l.setCreateTime(new Date());
            likeMapper.insert(l);
            liked = true;
        }
        Long count = Long.valueOf(likeMapper.selectCount(new QueryWrapper<BurningLike>()
                .eq("TARGET_ID", targetId).eq("BOARD", board)));
        Map<String, Object> out = new HashMap<>();
        out.put("liked", liked);
        out.put("count", count);
        return new Result<>(0, liked ? "已点赞" : "已取消", out);
    }

    /** 某人的评论（店内成员），新的在前，每页 5 条。 */
    @RequiresRole(Role.USER)
    @GetMapping("/comments")
    public Object comments(String targetId, Integer page, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isMember(me)) {
            return new Result<>(1, "你不是店里的成员", null);
        }
        if (StringUtils.isBlank(targetId)) {
            return new Result<>(1, "缺少目标用户", null);
        }
        int p = page == null || page < 1 ? 1 : page;
        Integer total = commentMapper.selectCount(new QueryWrapper<BurningComment>().eq("TARGET_ID", targetId));
        // ID as tiebreak: same-second CREATE_TIMEs otherwise paginate non-deterministically (dup/skip across pages)
        List<BurningComment> rows = commentMapper.selectList(new QueryWrapper<BurningComment>()
                .eq("TARGET_ID", targetId).orderByDesc("CREATE_TIME", "ID")
                .last("limit " + PAGE_SIZE + " offset " + (p - 1) * PAGE_SIZE));
        Set<String> uids = new HashSet<>();
        for (BurningComment c : rows) {
            uids.add(c.getAuthorId());
        }
        Map<String, DreamUser> users = new HashMap<>();
        if (!uids.isEmpty()) {
            for (DreamUser u : userMapper.selectBatchIds(uids)) {
                users.put(u.getUserId(), u);
            }
        }
        boolean manager = isManager(me);
        List<Map<String, Object>> outRows = new ArrayList<>();
        for (BurningComment c : rows) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", c.getId());
            m.put("authorId", c.getAuthorId());
            DreamUser u = users.get(c.getAuthorId());
            m.put("authorName", u == null ? c.getAuthorId() : u.getUserNickname());
            m.put("avatar", u == null ? null : u.getAvatar());
            m.put("content", c.getContent());
            m.put("createTime", c.getCreateTime());
            m.put("canDelete", manager || StringUtils.equals(c.getAuthorId(), me.getUserId()));
            outRows.add(m);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("total", total);
        out.put("pageSize", PAGE_SIZE);
        out.put("rows", outRows);
        return new Result<>(0, "成功", out);
    }

    /** 发评论（店内成员）。 */
    @RequiresRole(Role.USER)
    @PostMapping("/comment")
    public Object comment(String targetId, String content, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isMember(me)) {
            return new Result<>(1, "你不是店里的成员", null);
        }
        if (StringUtils.isBlank(targetId) || userMapper.selectById(targetId) == null) {
            return new Result<>(1, "用户不存在", null);
        }
        String c = StringUtils.trimToEmpty(content);
        if (c.isEmpty() || c.length() > COMMENT_MAX) {
            return new Result<>(1, "评论需为 1-" + COMMENT_MAX + " 字", null);
        }
        BurningComment row = new BurningComment();
        row.setId(UUID.randomUUID().toString());
        row.setTargetId(targetId);
        row.setAuthorId(me.getUserId());
        row.setContent(c);
        row.setCreateTime(new Date());
        commentMapper.insert(row);
        return new Result<>(0, "已评论", row.getId());
    }

    /** 删评论：作者本人或店长。 */
    @RequiresRole(Role.USER)
    @PostMapping("/deleteComment")
    public Object deleteComment(String id, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        BurningComment c = StringUtils.isBlank(id) ? null : commentMapper.selectById(id);
        if (c == null) {
            return new Result<>(1, "评论不存在", null);
        }
        if (!StringUtils.equals(c.getAuthorId(), me.getUserId()) && !isManager(me)) {
            return new Result<>(1, "只有作者或店长可以删除", null);
        }
        commentMapper.deleteById(id);
        return new Result<>(0, "已删除", null);
    }
}
