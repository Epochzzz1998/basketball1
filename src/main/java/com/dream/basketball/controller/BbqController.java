package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.BbqSettlement;
import com.dream.basketball.entity.BbqSkewerType;
import com.dream.basketball.entity.BbqStaff;
import com.dream.basketball.entity.BbqWageRecord;
import com.dream.basketball.entity.BbqWageSkewer;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.UserFollow;
import com.dream.basketball.mapper.BbqSkewerTypeMapper;
import com.dream.basketball.mapper.BbqStaffMapper;
import com.dream.basketball.mapper.BbqWageRecordMapper;
import com.dream.basketball.mapper.BbqWageSkewerMapper;
import com.dream.basketball.mapper.UserFollowMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * 耿阿姨烤串 — payroll for one hardcoded BBQ shop. Managers ('manager' in bbq_staff) share
 * full control of all books; plain staff are read-only over their own wages (ledger, batch 2).
 * Appointment rules: super admin appoints/demotes managers freely; a manager can add staff
 * (only people who follow them) and promote existing staff, never demote anyone.
 */
@RestController
@RequestMapping("/bbq")
public class BbqController {

    private static final int SKEWER_NAME_MAX = 20;
    private static final int SKEWER_LINES_MAX = 30;
    private static final int DEDUCT_REASON_MAX = 100;
    private static final BigDecimal RATE_MAX = new BigDecimal("999.99");
    private static final BigDecimal MONEY_MAX = new BigDecimal("99999.99");
    /** minutes of pay deducted when the worker ate at the shop */
    private static final int MEAL_MINUTES = 15;

    @Autowired
    private BbqStaffMapper staffMapper;
    @Autowired
    private BbqSkewerTypeMapper skewerTypeMapper;
    @Autowired
    private BbqWageRecordMapper wageMapper;
    @Autowired
    private BbqWageSkewerMapper wageSkewerMapper;
    @Autowired
    private com.dream.basketball.mapper.BbqSettlementMapper settlementMapper;
    @Autowired
    private UserFollowMapper followMapper;
    @Autowired
    private UserMapper userMapper;

    private boolean validDate(String d) {
        return d != null && d.matches("^\\d{4}-\\d{2}-\\d{2}$");
    }

    private boolean validTime(String t) {
        return t != null && t.matches("^([01]\\d|2[0-3]):[0-5]\\d$");
    }

    /** 'manager' | 'staff' | null */
    private String roleOf(String userId) {
        BbqStaff s = StringUtils.isBlank(userId) ? null : staffMapper.selectById(userId);
        return s == null ? null : s.getStaffRole();
    }

    private boolean isManager(DreamUser me) {
        return "manager".equals(roleOf(me.getUserId()));
    }

    private Map<String, DreamUser> usersById(Collection<String> ids) {
        Map<String, DreamUser> map = new HashMap<>();
        if (ids != null && !ids.isEmpty()) {
            for (DreamUser u : userMapper.selectBatchIds(ids)) {
                map.put(u.getUserId(), u);
            }
        }
        return map;
    }

    // ===== membership =====

    /** 成员列表（店长）：店长在前，带添加人昵称与每人最近一次时薪（表单默认值用）。 */
    @RequiresRole(Role.USER)
    @GetMapping("/staff/list")
    public Object staffList(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        List<BbqStaff> rows = staffMapper.selectList(new QueryWrapper<BbqStaff>().orderByAsc("ADD_TIME"));
        Set<String> uids = new HashSet<>();
        for (BbqStaff s : rows) {
            uids.add(s.getUserId());
            if (StringUtils.isNotBlank(s.getAddedBy())) {
                uids.add(s.getAddedBy());
            }
        }
        Map<String, DreamUser> users = usersById(uids);
        List<Map<String, Object>> out = new ArrayList<>();
        for (BbqStaff s : rows) {
            Map<String, Object> m = new HashMap<>();
            m.put("userId", s.getUserId());
            DreamUser u = users.get(s.getUserId());
            m.put("userNickname", u == null ? s.getUserId() : u.getUserNickname());
            m.put("avatar", u == null ? null : u.getAvatar());
            m.put("role", s.getStaffRole());
            DreamUser by = users.get(s.getAddedBy());
            m.put("addedByName", by == null ? null : by.getUserNickname());
            m.put("addTime", s.getAddTime());
            BbqWageRecord last = wageMapper.selectList(new QueryWrapper<BbqWageRecord>()
                    .eq("USER_ID", s.getUserId()).orderByDesc("WORK_DATE").last("limit 1"))
                    .stream().findFirst().orElse(null);
            m.put("lastRate", last == null ? null : last.getHourlyRate());
            out.add(m);
        }
        // managers first, then by join time (list is already ADD_TIME asc)
        out.sort(Comparator.comparing((Map<String, Object> m) -> "manager".equals(m.get("role")) ? 0 : 1));
        return new Result<>(0, "成功", out);
    }

    /** 可添加的人（店长）：关注我的、还不是店员的。 */
    @RequiresRole(Role.USER)
    @GetMapping("/staff/candidates")
    public Object candidates(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        List<String> followerIds = new ArrayList<>();
        for (UserFollow f : followMapper.selectList(new QueryWrapper<UserFollow>()
                .eq("FOLLOWEE_ID", me.getUserId()).last("limit 500"))) {
            followerIds.add(f.getFollowerId());
        }
        Set<String> already = new HashSet<>();
        for (BbqStaff s : staffMapper.selectList(null)) {
            already.add(s.getUserId());
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (DreamUser u : usersById(followerIds).values()) {
            if (already.contains(u.getUserId())) {
                continue;
            }
            Map<String, Object> m = new HashMap<>();
            m.put("userId", u.getUserId());
            m.put("userNickname", u.getUserNickname());
            m.put("avatar", u.getAvatar());
            out.add(m);
        }
        out.sort(Comparator.comparing(m -> String.valueOf(m.get("userNickname"))));
        return new Result<>(0, "成功", out);
    }

    /** 添加店员（店长）：只能添加关注我的人——关注是入职门槛，之后取关不影响成员身份。 */
    @RequiresRole(Role.USER)
    @PostMapping("/staff/add")
    public Object addStaff(String userId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        DreamUser target = StringUtils.isBlank(userId) ? null : userMapper.selectById(userId);
        if (target == null) {
            return new Result<>(1, "用户不存在", null);
        }
        if (staffMapper.selectById(userId) != null) {
            return new Result<>(1, "TA 已经是店里的成员了", null);
        }
        boolean followsMe = followMapper.selectCount(new QueryWrapper<UserFollow>()
                .eq("FOLLOWER_ID", userId).eq("FOLLOWEE_ID", me.getUserId())) > 0;
        if (!followsMe) {
            return new Result<>(1, "只能添加关注你的人", null);
        }
        BbqStaff s = new BbqStaff();
        s.setUserId(userId);
        s.setStaffRole("staff");
        s.setAddedBy(me.getUserId());
        s.setAddTime(new Date());
        staffMapper.insert(s);
        return new Result<>(0, "已添加为店员", null);
    }

    /** 移除店员（店长）：店长不可被移除（先由超管解除店长）。工资历史保留。 */
    @RequiresRole(Role.USER)
    @PostMapping("/staff/remove")
    public Object removeStaff(String userId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        BbqStaff s = StringUtils.isBlank(userId) ? null : staffMapper.selectById(userId);
        if (s == null) {
            return new Result<>(1, "TA 不是店里的成员", null);
        }
        if ("manager".equals(s.getStaffRole())) {
            return new Result<>(1, "店长只能由超级管理员解除", null);
        }
        staffMapper.deleteById(userId);
        return new Result<>(0, "已移除（工资历史保留）", null);
    }

    /** 提拔店长（店长）：只能从现有店员中提拔；解除店长是超管专属。 */
    @RequiresRole(Role.USER)
    @PostMapping("/staff/promote")
    public Object promote(String userId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        BbqStaff s = StringUtils.isBlank(userId) ? null : staffMapper.selectById(userId);
        if (s == null) {
            return new Result<>(1, "只能提拔现有店员", null);
        }
        if ("manager".equals(s.getStaffRole())) {
            return new Result<>(1, "TA 已经是店长了", null);
        }
        s.setStaffRole("manager");
        staffMapper.updateById(s);
        return new Result<>(0, "已提拔为店长", null);
    }

    /** 超管任命/解除店长：任命可指向任何用户（不在店里则直接入店）；解除后降为店员。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/adminSetManager")
    public Object adminSetManager(String userId, String on, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamUser target = StringUtils.isBlank(userId) ? null : userMapper.selectById(userId);
        if (target == null) {
            return new Result<>(1, "用户不存在", null);
        }
        BbqStaff s = staffMapper.selectById(userId);
        if ("1".equals(on)) {
            if (s == null) {
                s = new BbqStaff();
                s.setUserId(userId);
                s.setStaffRole("manager");
                s.setAddedBy(me.getUserId());
                s.setAddTime(new Date());
                staffMapper.insert(s);
            } else {
                s.setStaffRole("manager");
                staffMapper.updateById(s);
            }
            return new Result<>(0, "已任命为店长", null);
        }
        if (s == null || !"manager".equals(s.getStaffRole())) {
            return new Result<>(1, "TA 不是店长", null);
        }
        s.setStaffRole("staff");
        staffMapper.updateById(s);
        return new Result<>(0, "已解除店长（降为店员）", null);
    }

    // ===== skewer types =====

    /** 串价列表（店长）。 */
    @RequiresRole(Role.USER)
    @GetMapping("/skewer/list")
    public Object skewerList(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (BbqSkewerType t : skewerTypeMapper.selectList(new QueryWrapper<BbqSkewerType>().orderByAsc("CREATE_TIME"))) {
            Map<String, Object> m = new HashMap<>();
            m.put("typeId", t.getTypeId());
            m.put("name", t.getName());
            m.put("unitPrice", t.getUnitPrice());
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /** 新增/改名/改价（店长）。改价只影响以后的记录——历史记录存的是快照。 */
    @RequiresRole(Role.USER)
    @PostMapping("/skewer/save")
    public Object skewerSave(String typeId, String name, String price, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        String n = StringUtils.trimToEmpty(name);
        if (n.isEmpty() || n.length() > SKEWER_NAME_MAX) {
            return new Result<>(1, "串名需为 1-" + SKEWER_NAME_MAX + " 字", null);
        }
        BigDecimal p = parseMoney(price);
        if (p == null || p.compareTo(BigDecimal.ZERO) <= 0 || p.compareTo(RATE_MAX) > 0) {
            return new Result<>(1, "单价需在 0.01-999.99 之间", null);
        }
        QueryWrapper<BbqSkewerType> dup = new QueryWrapper<BbqSkewerType>().eq("NAME", n);
        if (StringUtils.isNotBlank(typeId)) {
            dup.ne("TYPE_ID", typeId);
        }
        if (skewerTypeMapper.selectCount(dup) > 0) {
            return new Result<>(1, "已有同名的串", null);
        }
        if (StringUtils.isNotBlank(typeId)) {
            BbqSkewerType t = skewerTypeMapper.selectById(typeId);
            if (t == null) {
                return new Result<>(1, "该串不存在", null);
            }
            t.setName(n);
            t.setUnitPrice(p);
            skewerTypeMapper.updateById(t);
            return new Result<>(0, "已保存（改价只影响以后的记录）", t.getTypeId());
        }
        BbqSkewerType t = new BbqSkewerType();
        t.setTypeId(UUID.randomUUID().toString());
        t.setName(n);
        t.setUnitPrice(p);
        t.setCreateTime(new Date());
        skewerTypeMapper.insert(t);
        return new Result<>(0, "已添加", t.getTypeId());
    }

    /** 删串（店长）：历史记录存的是快照，不受影响。 */
    @RequiresRole(Role.USER)
    @PostMapping("/skewer/delete")
    public Object skewerDelete(String typeId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        if (StringUtils.isBlank(typeId) || skewerTypeMapper.selectById(typeId) == null) {
            return new Result<>(1, "该串不存在", null);
        }
        skewerTypeMapper.deleteById(typeId);
        return new Result<>(0, "已删除（历史记录不受影响）", null);
    }

    // ===== wage records =====

    /** 某月全部记录（店长）：日历格子用的轻量列表，前端按日期归组。month 形如 2026-07。 */
    @RequiresRole(Role.USER)
    @GetMapping("/wage/month")
    public Object wageMonth(String month, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        if (month == null || !month.matches("^\\d{4}-\\d{2}$")) {
            return new Result<>(1, "月份格式应为 yyyy-MM", null);
        }
        List<BbqWageRecord> records = wageMapper.selectList(new QueryWrapper<BbqWageRecord>()
                .likeRight("WORK_DATE", month + "-")
                .orderByAsc("WORK_DATE", "START_TIME"));
        Set<String> uids = new HashSet<>();
        for (BbqWageRecord r : records) {
            uids.add(r.getUserId());
        }
        Map<String, DreamUser> users = usersById(uids);
        List<Map<String, Object>> out = new ArrayList<>();
        for (BbqWageRecord r : records) {
            Map<String, Object> m = new HashMap<>();
            m.put("recordId", r.getRecordId());
            m.put("userId", r.getUserId());
            DreamUser u = users.get(r.getUserId());
            m.put("userNickname", u == null ? r.getUserId() : u.getUserNickname());
            m.put("date", r.getWorkDate());
            m.put("startTime", r.getStartTime());
            m.put("endTime", r.getEndTime());
            m.put("total", r.getTotal());
            m.put("settled", StringUtils.isNotBlank(r.getSettleId()));
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /** 某天的完整记录（店长）：弹窗编辑用，含穿串明细。 */
    @RequiresRole(Role.USER)
    @GetMapping("/wage/day")
    public Object wageDay(String date, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        if (!validDate(date)) {
            return new Result<>(1, "日期格式应为 yyyy-MM-dd", null);
        }
        List<BbqWageRecord> records = wageMapper.selectList(new QueryWrapper<BbqWageRecord>()
                .eq("WORK_DATE", date).orderByAsc("START_TIME", "CREATE_TIME"));
        Set<String> uids = new HashSet<>();
        List<String> recordIds = new ArrayList<>();
        for (BbqWageRecord r : records) {
            uids.add(r.getUserId());
            recordIds.add(r.getRecordId());
        }
        Map<String, DreamUser> users = usersById(uids);
        Map<String, List<Map<String, Object>>> skewersByRecord = new HashMap<>();
        if (!recordIds.isEmpty()) {
            for (BbqWageSkewer w : wageSkewerMapper.selectList(new QueryWrapper<BbqWageSkewer>().in("RECORD_ID", recordIds))) {
                Map<String, Object> sm = new HashMap<>();
                sm.put("typeId", w.getTypeId());
                sm.put("name", w.getNameSnap());
                sm.put("price", w.getPriceSnap());
                sm.put("num", w.getNum());
                skewersByRecord.computeIfAbsent(w.getRecordId(), (k) -> new ArrayList<>()).add(sm);
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (BbqWageRecord r : records) {
            Map<String, Object> m = new HashMap<>();
            m.put("recordId", r.getRecordId());
            m.put("userId", r.getUserId());
            DreamUser u = users.get(r.getUserId());
            m.put("userNickname", u == null ? r.getUserId() : u.getUserNickname());
            m.put("avatar", u == null ? null : u.getAvatar());
            m.put("startTime", r.getStartTime());
            m.put("endTime", r.getEndTime());
            m.put("hourlyRate", r.getHourlyRate());
            m.put("meal", "1".equals(r.getMeal()));
            m.put("deduct", r.getDeduct());
            m.put("deductReason", r.getDeductReason());
            m.put("skewerPay", r.getSkewerPay());
            m.put("total", r.getTotal());
            m.put("settled", StringUtils.isNotBlank(r.getSettleId()));
            m.put("skewers", skewersByRecord.getOrDefault(r.getRecordId(), new ArrayList<>()));
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /**
     * 记账/改账（店长）。skewers 是 JSON 数组 [{typeId, num}]，价格按当前串价快照进记录。
     * 结束时刻早于等于开始时刻 = 干到次日（记在开始那天的账上）。吃饭扣 15 分钟工时。
     * 当日合计一律后端算：工时×时薪 − 其他扣款 + 穿串。一人一天一条。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/wage/save")
    public Object wageSave(String recordId, String userId, String workDate, String startTime, String endTime,
                           String hourlyRate, String meal, String deduct, String deductReason, String skewers,
                           HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        String targetRole = roleOf(userId);
        if (targetRole == null) {
            return new Result<>(1, "只能给店里的成员记账", null);
        }
        // 店长不参与薪资计算——新账一律拒；店员升店长前的旧账允许继续编辑（历史要能修）
        if ("manager".equals(targetRole) && StringUtils.isBlank(recordId)) {
            return new Result<>(1, "店长不参与薪资计算，只能给店员记账", null);
        }
        if (!validDate(workDate)) {
            return new Result<>(1, "日期格式应为 yyyy-MM-dd", null);
        }
        if (!validTime(startTime) || !validTime(endTime)) {
            return new Result<>(1, "时间格式应为 HH:mm", null);
        }
        BigDecimal rate = parseMoney(hourlyRate);
        if (rate == null || rate.compareTo(BigDecimal.ZERO) <= 0 || rate.compareTo(RATE_MAX) > 0) {
            return new Result<>(1, "时薪需在 0.01-999.99 之间", null);
        }
        BigDecimal ded = StringUtils.isBlank(deduct) ? BigDecimal.ZERO : parseMoney(deduct);
        if (ded == null || ded.compareTo(BigDecimal.ZERO) < 0 || ded.compareTo(MONEY_MAX) > 0) {
            return new Result<>(1, "扣款金额不合法", null);
        }
        String reason = StringUtils.trimToNull(deductReason);
        if (ded.compareTo(BigDecimal.ZERO) > 0 && reason == null) {
            return new Result<>(1, "有扣款必须写明原因", null);
        }
        if (reason != null && reason.length() > DEDUCT_REASON_MAX) {
            return new Result<>(1, "扣款原因不能超过 " + DEDUCT_REASON_MAX + " 字", null);
        }
        boolean ate = "1".equals(meal);

        BbqWageRecord r;
        if (StringUtils.isNotBlank(recordId)) {
            r = wageMapper.selectById(recordId);
            if (r == null) {
                return new Result<>(1, "记录不存在", null);
            }
            if (StringUtils.isNotBlank(r.getSettleId())) {
                return new Result<>(1, "已结清的记录不可修改", null);
            }
            // editing may keep a promoted-to-manager person's own legacy record, but not move a record onto a manager
            if ("manager".equals(targetRole) && !StringUtils.equals(r.getUserId(), userId)) {
                return new Result<>(1, "店长不参与薪资计算，只能给店员记账", null);
            }
        } else {
            r = new BbqWageRecord();
            r.setRecordId(UUID.randomUUID().toString());
            r.setCreateBy(me.getUserId());
            r.setCreateTime(new Date());
        }
        // lines already on this record keep their entry-time snapshots across edits —
        // "改价只影响以后的记录" must survive editing an unrelated field of an old record
        Map<String, BbqWageSkewer> oldLines = new HashMap<>();
        if (StringUtils.isNotBlank(recordId)) {
            for (BbqWageSkewer w : wageSkewerMapper.selectList(new QueryWrapper<BbqWageSkewer>().eq("RECORD_ID", r.getRecordId()))) {
                if (StringUtils.isNotBlank(w.getTypeId())) {
                    oldLines.put(w.getTypeId(), w);
                }
            }
        }
        // parse skewer lines: existing lines reuse their old snapshot, new lines snapshot current price
        List<BbqWageSkewer> lines = new ArrayList<>();
        BigDecimal skewerPay = BigDecimal.ZERO;
        if (StringUtils.isNotBlank(skewers)) {
            JSONArray arr;
            try {
                arr = JSON.parseArray(skewers);
            } catch (Exception e) {
                return new Result<>(1, "穿串数据格式错误", null);
            }
            if (arr.size() > SKEWER_LINES_MAX) {
                return new Result<>(1, "穿串最多 " + SKEWER_LINES_MAX + " 行", null);
            }
            Set<String> seenTypes = new HashSet<>();
            for (int i = 0; i < arr.size(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String typeId = o.getString("typeId");
                Integer num = o.getInteger("num");
                if (StringUtils.isBlank(typeId)) {
                    return new Result<>(1, "穿串要选择串的种类", null);
                }
                if (!seenTypes.add(typeId)) {
                    return new Result<>(1, "同一种串不要重复添加", null);
                }
                if (num == null || num < 1 || num > 99999) {
                    return new Result<>(1, "串数需在 1-99999 之间", null);
                }
                String nameSnap;
                BigDecimal priceSnap;
                BbqWageSkewer old = oldLines.get(typeId);
                if (old != null) {
                    nameSnap = old.getNameSnap();
                    priceSnap = old.getPriceSnap();
                } else {
                    BbqSkewerType t = skewerTypeMapper.selectById(typeId);
                    if (t == null) {
                        return new Result<>(1, "所选的串不存在，请刷新后重试", null);
                    }
                    nameSnap = t.getName();
                    priceSnap = t.getUnitPrice();
                }
                BbqWageSkewer line = new BbqWageSkewer();
                line.setId(UUID.randomUUID().toString());
                line.setTypeId(typeId);
                line.setNameSnap(nameSnap);
                line.setPriceSnap(priceSnap);
                line.setNum(num);
                lines.add(line);
                skewerPay = skewerPay.add(priceSnap.multiply(BigDecimal.valueOf(num)));
            }
        }
        // shift minutes: end<=start means past midnight; meal knocks 15min off paid time
        int startMin = toMinutes(startTime);
        int endMin = toMinutes(endTime);
        int worked = endMin - startMin;
        if (worked <= 0) {
            worked += 24 * 60;
        }
        int paidMinutes = Math.max(0, worked - (ate ? MEAL_MINUTES : 0));
        BigDecimal base = rate.multiply(BigDecimal.valueOf(paidMinutes))
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        BigDecimal total = base.subtract(ded).add(skewerPay);
        // one record per person per day (self excluded when editing)
        QueryWrapper<BbqWageRecord> dup = new QueryWrapper<BbqWageRecord>()
                .eq("USER_ID", userId).eq("WORK_DATE", workDate);
        if (StringUtils.isNotBlank(r.getRecordId()) && StringUtils.isNotBlank(recordId)) {
            dup.ne("RECORD_ID", r.getRecordId());
        }
        if (wageMapper.selectCount(dup) > 0) {
            return new Result<>(1, "TA 这天已有记录，请直接编辑那条", null);
        }
        r.setUserId(userId);
        r.setWorkDate(workDate);
        r.setStartTime(startTime);
        r.setEndTime(endTime);
        r.setHourlyRate(rate);
        r.setMeal(ate ? "1" : null);
        r.setDeduct(ded);
        r.setDeductReason(ded.compareTo(BigDecimal.ZERO) > 0 ? reason : null);
        r.setSkewerPay(skewerPay);
        r.setTotal(total);
        r.setUpdateBy(me.getUserId());
        r.setUpdateTime(new Date());
        if (StringUtils.isNotBlank(recordId)) {
            wageMapper.updateById(r);
            wageSkewerMapper.delete(new QueryWrapper<BbqWageSkewer>().eq("RECORD_ID", r.getRecordId()));
        } else {
            wageMapper.insert(r);
        }
        for (BbqWageSkewer line : lines) {
            line.setRecordId(r.getRecordId());
            wageSkewerMapper.insert(line);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("recordId", r.getRecordId());
        out.put("base", base);
        out.put("skewerPay", skewerPay);
        out.put("total", total);
        return new Result<>(0, "已保存", out);
    }

    /** 删记录（店长）：已结清的不可删。 */
    @RequiresRole(Role.USER)
    @PostMapping("/wage/delete")
    public Object wageDelete(String recordId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        BbqWageRecord r = StringUtils.isBlank(recordId) ? null : wageMapper.selectById(recordId);
        if (r == null) {
            return new Result<>(1, "记录不存在", null);
        }
        if (StringUtils.isNotBlank(r.getSettleId())) {
            return new Result<>(1, "已结清的记录不可删除", null);
        }
        wageSkewerMapper.delete(new QueryWrapper<BbqWageSkewer>().eq("RECORD_ID", recordId));
        wageMapper.deleteById(recordId);
        return new Result<>(0, "已删除", null);
    }

    // ===== settlement =====

    /** unsettled records up to the chosen date (blank = today Melbourne), optionally scoped to userIds (JSON array) */
    private List<BbqWageRecord> unsettledScope(String userIds, String toDate) {
        String cutoff = validDate(toDate) ? toDate
                : java.time.LocalDate.now(java.time.ZoneId.of("Australia/Melbourne")).toString();
        QueryWrapper<BbqWageRecord> qw = new QueryWrapper<BbqWageRecord>()
                .isNull("SETTLE_ID").le("WORK_DATE", cutoff);
        if (StringUtils.isNotBlank(userIds)) {
            List<String> ids = new ArrayList<>();
            try {
                for (Object o : JSON.parseArray(userIds)) {
                    if (o != null && StringUtils.isNotBlank(o.toString())) {
                        ids.add(o.toString());
                    }
                }
            } catch (Exception e) {
                return null;
            }
            if (!ids.isEmpty()) {
                qw.in("USER_ID", ids);
            }
        }
        return wageMapper.selectList(qw.orderByAsc("USER_ID", "WORK_DATE"));
    }

    /** per-user rollup of unsettled records, nickname-resolved, for both preview and confirm */
    private List<Map<String, Object>> rollupByUser(List<BbqWageRecord> records) {
        Map<String, List<BbqWageRecord>> byUser = new LinkedHashMap<>();
        for (BbqWageRecord r : records) {
            byUser.computeIfAbsent(r.getUserId(), (k) -> new ArrayList<>()).add(r);
        }
        Map<String, DreamUser> users = usersById(byUser.keySet());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, List<BbqWageRecord>> e : byUser.entrySet()) {
            BigDecimal amount = BigDecimal.ZERO;
            String from = null;
            String to = null;
            for (BbqWageRecord r : e.getValue()) {
                amount = amount.add(r.getTotal());
                if (from == null || r.getWorkDate().compareTo(from) < 0) {
                    from = r.getWorkDate();
                }
                if (to == null || r.getWorkDate().compareTo(to) > 0) {
                    to = r.getWorkDate();
                }
            }
            Map<String, Object> m = new HashMap<>();
            m.put("userId", e.getKey());
            DreamUser u = users.get(e.getKey());
            m.put("userNickname", u == null ? e.getKey() : u.getUserNickname());
            m.put("avatar", u == null ? null : u.getAvatar());
            m.put("fromDate", from);
            m.put("toDate", to);
            m.put("recordCount", e.getValue().size());
            m.put("amount", amount);
            out.add(m);
        }
        return out;
    }

    /**
     * 结清预览（店长）：确认弹窗用——要结清哪些人、各多少钱。范围=未结清且日期≤toDate 的记录
     * （toDate 店长自选，缺省=今天，可以是未来）；userIds（JSON 数组）为空 = 所有有未结清账的人
     * （包括已离店的，余账仍可结）。
     */
    @RequiresRole(Role.USER)
    @GetMapping("/settle/preview")
    public Object settlePreview(String userIds, String toDate, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        if (StringUtils.isNotBlank(toDate) && !validDate(toDate)) {
            return new Result<>(1, "日期格式应为 yyyy-MM-dd", null);
        }
        List<BbqWageRecord> records = unsettledScope(userIds, toDate);
        if (records == null) {
            return new Result<>(1, "筛选数据格式错误", null);
        }
        return new Result<>(0, "成功", rollupByUser(records));
    }

    /**
     * 结清（店长）：与预览同一口径重算（以点击时的库内数据为准），一人落一张 bbq_settlement 凭据，
     * 相关记录盖上 SETTLE_ID——从此不可改不可删。toDate 之后的记录不结（留在下一次）。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/settle/confirm")
    public Object settleConfirm(String userIds, String toDate, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (!isManager(me)) {
            return new Result<>(1, "只有店长可以操作", null);
        }
        if (StringUtils.isNotBlank(toDate) && !validDate(toDate)) {
            return new Result<>(1, "日期格式应为 yyyy-MM-dd", null);
        }
        List<BbqWageRecord> records = unsettledScope(userIds, toDate);
        if (records == null) {
            return new Result<>(1, "筛选数据格式错误", null);
        }
        if (records.isEmpty()) {
            return new Result<>(1, "没有可结清的记录", null);
        }
        List<Map<String, Object>> rollup = rollupByUser(records);
        Map<String, List<String>> idsByUser = new HashMap<>();
        for (BbqWageRecord r : records) {
            idsByUser.computeIfAbsent(r.getUserId(), (k) -> new ArrayList<>()).add(r.getRecordId());
        }
        BigDecimal grand = BigDecimal.ZERO;
        int recordTotal = 0;
        for (Map<String, Object> m : rollup) {
            String uid = (String) m.get("userId");
            BbqSettlement s = new BbqSettlement();
            s.setSettleId(UUID.randomUUID().toString());
            s.setUserId(uid);
            s.setFromDate((String) m.get("fromDate"));
            s.setToDate((String) m.get("toDate"));
            s.setAmount((BigDecimal) m.get("amount"));
            s.setRecordCount((Integer) m.get("recordCount"));
            s.setSettledBy(me.getUserId());
            s.setSettleTime(new Date());
            settlementMapper.insert(s);
            wageMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<BbqWageRecord>()
                    .in("RECORD_ID", idsByUser.get(uid)).set("SETTLE_ID", s.getSettleId()));
            grand = grand.add(s.getAmount());
            recordTotal += s.getRecordCount();
        }
        Map<String, Object> out = new HashMap<>();
        out.put("users", rollup.size());
        out.put("records", recordTotal);
        out.put("amount", grand);
        return new Result<>(0, "已结清 " + rollup.size() + " 人、共 " + money(grand), out);
    }

    // ===== ledger =====

    /**
     * 台账（店内成员）：店长=全店当月（每日柱状 + 员工占比 + 薪资结构 + 每人聚合行 + 未结清），
     * 店员=只有自己（结构 + 自己的记录明细）。数字全在这里算好，前端只画。
     */
    // NB: path must NOT be exactly "/ledger" — that's the SPA page route; a same-path GET here
    // would swallow browser navigation before the SPA fallback (bit us once via headless check)
    // Range: pass month=yyyy-MM (月视图) OR from+to dates (周视图 or any custom span ≤93 days).
    @RequiresRole(Role.USER)
    @GetMapping("/ledger/data")
    public Object ledger(String month, String from, String to, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        String role = roleOf(me.getUserId());
        if (role == null) {
            return new Result<>(1, "你不是店里的成员", null);
        }
        boolean manager = "manager".equals(role);
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
            rangeTo = month + "-31"; // lexical upper bound is fine for zero-padded dates
        } else {
            return new Result<>(1, "需要月份（yyyy-MM）或起止日期", null);
        }
        QueryWrapper<BbqWageRecord> qw = new QueryWrapper<BbqWageRecord>()
                .between("WORK_DATE", rangeFrom, rangeTo).orderByAsc("WORK_DATE", "START_TIME");
        if (!manager) {
            qw.eq("USER_ID", me.getUserId());
        }
        List<BbqWageRecord> records = wageMapper.selectList(qw);
        // all-time unsettled (per user), same visibility scope
        QueryWrapper<BbqWageRecord> uqw = new QueryWrapper<BbqWageRecord>().isNull("SETTLE_ID");
        if (!manager) {
            uqw.eq("USER_ID", me.getUserId());
        }
        Map<String, BigDecimal> unsettledByUser = new HashMap<>();
        BigDecimal unsettledTotal = BigDecimal.ZERO;
        for (BbqWageRecord r : wageMapper.selectList(uqw)) {
            unsettledByUser.merge(r.getUserId(), r.getTotal(), BigDecimal::add);
            unsettledTotal = unsettledTotal.add(r.getTotal());
        }
        // month aggregates
        Map<String, BigDecimal> dailyTotals = new TreeMap<>();
        Map<String, Map<String, Object>> perUser = new LinkedHashMap<>();
        BigDecimal monthTotal = BigDecimal.ZERO;
        BigDecimal baseSum = BigDecimal.ZERO;
        BigDecimal skewerSum = BigDecimal.ZERO;
        BigDecimal deductSum = BigDecimal.ZERO;
        for (BbqWageRecord r : records) {
            BigDecimal base = r.getTotal().add(r.getDeduct()).subtract(r.getSkewerPay());
            monthTotal = monthTotal.add(r.getTotal());
            baseSum = baseSum.add(base);
            skewerSum = skewerSum.add(r.getSkewerPay());
            deductSum = deductSum.add(r.getDeduct());
            dailyTotals.merge(r.getWorkDate(), r.getTotal(), BigDecimal::add);
            Map<String, Object> u = perUser.computeIfAbsent(r.getUserId(), (k) -> {
                Map<String, Object> m = new HashMap<>();
                m.put("userId", k);
                m.put("days", 0);
                m.put("minutes", 0);
                m.put("base", BigDecimal.ZERO);
                m.put("skewer", BigDecimal.ZERO);
                m.put("deduct", BigDecimal.ZERO);
                m.put("total", BigDecimal.ZERO);
                return m;
            });
            int worked = toMinutes(r.getEndTime()) - toMinutes(r.getStartTime());
            if (worked <= 0) {
                worked += 24 * 60;
            }
            int paid = Math.max(0, worked - ("1".equals(r.getMeal()) ? MEAL_MINUTES : 0));
            u.put("days", (Integer) u.get("days") + 1);
            u.put("minutes", (Integer) u.get("minutes") + paid);
            u.put("base", ((BigDecimal) u.get("base")).add(base));
            u.put("skewer", ((BigDecimal) u.get("skewer")).add(r.getSkewerPay()));
            u.put("deduct", ((BigDecimal) u.get("deduct")).add(r.getDeduct()));
            u.put("total", ((BigDecimal) u.get("total")).add(r.getTotal()));
        }
        Map<String, DreamUser> users = usersById(perUser.keySet());
        List<Map<String, Object>> userRows = new ArrayList<>();
        for (Map<String, Object> m : perUser.values()) {
            String uid = (String) m.get("userId");
            DreamUser u = users.get(uid);
            m.put("userNickname", u == null ? uid : u.getUserNickname());
            m.put("avatar", u == null ? null : u.getAvatar());
            m.put("unsettled", unsettledByUser.getOrDefault(uid, BigDecimal.ZERO));
            userRows.add(m);
        }
        userRows.sort((a, b) -> ((BigDecimal) b.get("total")).compareTo((BigDecimal) a.get("total")));
        List<Map<String, Object>> daily = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> e : dailyTotals.entrySet()) {
            Map<String, Object> m = new HashMap<>();
            m.put("date", e.getKey());
            m.put("total", e.getValue());
            daily.add(m);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("role", role);
        out.put("monthTotal", monthTotal);
        out.put("baseSum", baseSum);
        out.put("skewerSum", skewerSum);
        out.put("deductSum", deductSum);
        out.put("unsettledTotal", unsettledTotal);
        out.put("daily", daily);
        out.put("users", userRows);
        // staff see their own per-record detail (incl. skewer lines) to verify the books
        if (!manager) {
            List<String> recordIds = new ArrayList<>();
            for (BbqWageRecord r : records) {
                recordIds.add(r.getRecordId());
            }
            Map<String, List<Map<String, Object>>> skewersByRecord = new HashMap<>();
            if (!recordIds.isEmpty()) {
                for (BbqWageSkewer w : wageSkewerMapper.selectList(new QueryWrapper<BbqWageSkewer>().in("RECORD_ID", recordIds))) {
                    Map<String, Object> sm = new HashMap<>();
                    sm.put("name", w.getNameSnap());
                    sm.put("price", w.getPriceSnap());
                    sm.put("num", w.getNum());
                    skewersByRecord.computeIfAbsent(w.getRecordId(), (k) -> new ArrayList<>()).add(sm);
                }
            }
            List<Map<String, Object>> recOut = new ArrayList<>();
            for (BbqWageRecord r : records) {
                Map<String, Object> m = new HashMap<>();
                m.put("recordId", r.getRecordId());
                m.put("date", r.getWorkDate());
                m.put("startTime", r.getStartTime());
                m.put("endTime", r.getEndTime());
                m.put("hourlyRate", r.getHourlyRate());
                m.put("meal", "1".equals(r.getMeal()));
                m.put("deduct", r.getDeduct());
                m.put("deductReason", r.getDeductReason());
                m.put("skewerPay", r.getSkewerPay());
                m.put("total", r.getTotal());
                m.put("settled", StringUtils.isNotBlank(r.getSettleId()));
                m.put("skewers", skewersByRecord.getOrDefault(r.getRecordId(), new ArrayList<>()));
                recOut.add(m);
            }
            out.put("records", recOut);
        }
        return new Result<>(0, "成功", out);
    }

    private String money(BigDecimal v) {
        return "$" + v.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private int toMinutes(String hhmm) {
        return Integer.parseInt(hhmm.substring(0, 2)) * 60 + Integer.parseInt(hhmm.substring(3));
    }

    /** strict money: numeric, ≤2 decimal places; null when malformed */
    private BigDecimal parseMoney(String s) {
        if (StringUtils.isBlank(s) || !s.trim().matches("^\\d{1,6}(\\.\\d{1,2})?$")) {
            return null;
        }
        return new BigDecimal(s.trim()).setScale(2, RoundingMode.UNNECESSARY);
    }
}
