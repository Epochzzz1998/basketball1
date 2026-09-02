package com.dream.basketball.controller;

import com.dream.basketball.common.Result;
import com.dream.basketball.entity.BbqSettlement;
import com.dream.basketball.entity.BbqStaff;
import com.dream.basketball.entity.BbqWageRecord;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.BbqSettlementMapper;
import com.dream.basketball.mapper.BbqStaffMapper;
import com.dream.basketball.mapper.BbqWageRecordMapper;
import com.dream.basketball.mapper.BbqWageSkewerMapper;
import com.dream.basketball.utils.SecUtil;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * 改/删一条**已结清**的记录之后，那张结清凭据（`bbq_settlement`）要跟着重算。
 *
 * <p>背景：2026-09-02 之前，盖了 SETTLE_ID 的记录不可改不可删，凭据上的 AMOUNT / RECORD_COUNT
 * 因此永远为真。放开之后这个保证没了——改一条记录的金额，凭据立刻变成一张假条。
 * 选的对策是「跟着重算」，这个类就是钉住那个对策。
 *
 * <p>**为什么值得写测试**：这张凭据**全站没有任何界面显示它**。它错了不会有人看见，
 * 不会有工单，不会有报错——只会在某天有人翻库对账的时候变成一个说不清的差额。
 * 没有 UI 反馈的正确性，只能靠测试守。
 *
 * <p>四种情形各钉一条，其中两条是「不该做什么」：
 * 未结清的记录被删时不能去碰凭据表，删光一批时不能留下孤儿凭据。
 */
class BbqSettlementResyncTest {

    private static final String MANAGER = "u-manager";
    private static final String STAFF = "u-staff";
    private static final String SETTLE = "s-1";

    private final BbqWageRecordMapper wageMapper = Mockito.mock(BbqWageRecordMapper.class);
    private final BbqWageSkewerMapper skewerMapper = Mockito.mock(BbqWageSkewerMapper.class);
    private final BbqSettlementMapper settlementMapper = Mockito.mock(BbqSettlementMapper.class);
    private final BbqStaffMapper staffMapper = Mockito.mock(BbqStaffMapper.class);

    private final BbqController controller = new BbqController();

    BbqSettlementResyncTest() {
        ReflectionTestUtils.setField(controller, "wageMapper", wageMapper);
        ReflectionTestUtils.setField(controller, "wageSkewerMapper", skewerMapper);
        ReflectionTestUtils.setField(controller, "settlementMapper", settlementMapper);
        ReflectionTestUtils.setField(controller, "staffMapper", staffMapper);
        // 店长身份：wageDelete 第一件事就是查它
        BbqStaff boss = new BbqStaff();
        boss.setUserId(MANAGER);
        boss.setStaffRole("manager");
        Mockito.when(staffMapper.selectById(MANAGER)).thenReturn(boss);
    }

    /** 登录态：SecUtil 从 session 取人，这里塞一个店长进去 */
    private MockHttpServletRequest asManager() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        DreamUser me = new DreamUser();
        me.setUserId(MANAGER);
        SecUtil.setLoginUserToSession(req, me);
        return req;
    }

    private BbqWageRecord record(String id, String date, String amount, String settleId) {
        BbqWageRecord r = new BbqWageRecord();
        r.setRecordId(id);
        r.setUserId(STAFF);
        r.setWorkDate(date);
        r.setTotal(new BigDecimal(amount));
        r.setDeduct(BigDecimal.ZERO);
        r.setSkewerPay(BigDecimal.ZERO);
        r.setSettleId(settleId);
        return r;
    }

    private BbqSettlement voucher(String amount, int count, String from, String to) {
        BbqSettlement s = new BbqSettlement();
        s.setSettleId(SETTLE);
        s.setUserId(STAFF);
        s.setAmount(new BigDecimal(amount));
        s.setRecordCount(count);
        s.setFromDate(from);
        s.setToDate(to);
        return s;
    }

    /**
     * 删掉一批里的一条：凭据的金额、条数、起止日**全部**按剩下的重算。
     *
     * 原始数据：一批三条 40 + 50 + 30 = 120，日期 08-01 ~ 08-03。
     * 删掉 08-01 那条 40 之后，剩下 50 + 30 = 80，两条，日期变成 08-02 ~ 08-03。
     *
     * 起止日也要重算是这条最容易漏的地方——只改金额和条数的话，凭据会一直声称
     * 这批账是从 08-01 开始的，而 08-01 那天已经没有记录了。
     */
    @Test
    void deletingOneOfThree_recomputesAmountCountAndDates() {
        BbqWageRecord doomed = record("r-1", "2026-08-01", "40.00", SETTLE);
        Mockito.when(wageMapper.selectById("r-1")).thenReturn(doomed);
        // 删完之后再查这批还剩谁——mock 直接给出删后的结果
        Mockito.when(wageMapper.selectList(ArgumentMatchers.any())).thenReturn(new ArrayList<>(Arrays.asList(
                record("r-2", "2026-08-02", "50.00", SETTLE),
                record("r-3", "2026-08-03", "30.00", SETTLE))));
        Mockito.when(settlementMapper.selectById(SETTLE)).thenReturn(voucher("120.00", 3, "2026-08-01", "2026-08-03"));

        Result<?> res = (Result<?>) controller.wageDelete("r-1", asManager());
        assertEquals(0, res.getCode(), res.getMsg());

        ArgumentCaptor<BbqSettlement> cap = ArgumentCaptor.forClass(BbqSettlement.class);
        Mockito.verify(settlementMapper).updateById(cap.capture());
        BbqSettlement after = cap.getValue();
        assertEquals(0, new BigDecimal("80.00").compareTo(after.getAmount()), "金额应为剩下两条之和");
        assertEquals(2, after.getRecordCount());
        assertEquals("2026-08-02", after.getFromDate(), "起始日要跟着往后挪");
        assertEquals("2026-08-03", after.getToDate());
        Mockito.verify(settlementMapper, Mockito.never()).deleteById(ArgumentMatchers.anyString());
    }

    /**
     * 删掉一批里的最后一条：凭据本身也要删掉，不能留成孤儿。
     *
     * 不照做会怎样：库里留下一张「结了 40 块、1 条记录」的凭据，而那条记录已经不存在了。
     * 以后按凭据统计"总共发过多少工资"会多出这 40 块，且**没有任何记录能对得上**。
     */
    @Test
    void deletingTheLastOne_dropsTheVoucher() {
        Mockito.when(wageMapper.selectById("r-1")).thenReturn(record("r-1", "2026-08-01", "40.00", SETTLE));
        Mockito.when(wageMapper.selectList(ArgumentMatchers.any())).thenReturn(new ArrayList<>());
        Mockito.when(settlementMapper.selectById(SETTLE)).thenReturn(voucher("40.00", 1, "2026-08-01", "2026-08-01"));

        Result<?> res = (Result<?>) controller.wageDelete("r-1", asManager());
        assertEquals(0, res.getCode(), res.getMsg());

        Mockito.verify(settlementMapper).deleteById(SETTLE);
        Mockito.verify(settlementMapper, Mockito.never()).updateById(ArgumentMatchers.any());
    }

    /**
     * 删一条**未结清**的记录：凭据表一下都不能碰。
     *
     * 这条钉的是 `resyncSettlement` 开头那个空值早退。没有它的话，
     * 每删一条普通记录都会拿 null 去查凭据表——查不出东西不报错，
     * 但那是一次白跑的查询，而且下一步 `left.isEmpty()` 成立会走进删除分支，
     * 拿着 null 去 deleteById。这是那种"看起来没事、直到某天真删掉一行"的错。
     */
    @Test
    void deletingAnUnsettledRecord_leavesSettlementsAlone() {
        Mockito.when(wageMapper.selectById("r-9")).thenReturn(record("r-9", "2026-08-05", "60.00", null));

        Result<?> res = (Result<?>) controller.wageDelete("r-9", asManager());
        assertEquals(0, res.getCode(), res.getMsg());

        Mockito.verifyNoInteractions(settlementMapper);
    }

    /**
     * 凭据行本身不见了（人工删过、或者上一次重算已经清掉）：不该抛异常，安静收场。
     *
     * 记录还在、凭据没了是个不该出现的状态，但真出现的时候，一个 NPE 会让店长
     * **连这条记录都删不掉**——把自己锁在一个坏状态里，比放过它更糟。
     */
    @Test
    void missingVoucher_doesNotBlowUp() {
        Mockito.when(wageMapper.selectById("r-1")).thenReturn(record("r-1", "2026-08-01", "40.00", SETTLE));
        Mockito.when(wageMapper.selectList(ArgumentMatchers.any())).thenReturn(new ArrayList<>(
                Collections.singletonList(record("r-2", "2026-08-02", "50.00", SETTLE))));
        Mockito.when(settlementMapper.selectById(SETTLE)).thenReturn(null);

        Result<?> res = (Result<?>) controller.wageDelete("r-1", asManager());
        assertEquals(0, res.getCode(), res.getMsg());
        Mockito.verify(settlementMapper, Mockito.never()).updateById(ArgumentMatchers.any());
    }

    /** 非店长删不了任何记录——放开结清锁不能顺手放开身份校验 */
    @Test
    void staffCannotDelete() {
        BbqStaff worker = new BbqStaff();
        worker.setUserId(STAFF);
        worker.setStaffRole("staff");
        Mockito.when(staffMapper.selectById(STAFF)).thenReturn(worker);
        MockHttpServletRequest req = new MockHttpServletRequest();
        DreamUser me = new DreamUser();
        me.setUserId(STAFF);
        SecUtil.setLoginUserToSession(req, me);

        Result<?> res = (Result<?>) controller.wageDelete("r-1", req);
        assertEquals(1, res.getCode());
        Mockito.verifyNoInteractions(settlementMapper);
        Mockito.verify(wageMapper, Mockito.never()).deleteById(ArgumentMatchers.anyString());
    }

    /** 结清凭据是按人开的，一条已结清的记录不能改到别人名下——重算救不回横跨两个人的凭据 */
    @Test
    void settledRecordCannotBeMovedToAnotherPerson() {
        String other = "u-other";
        BbqStaff worker = new BbqStaff();
        worker.setUserId(other);
        worker.setStaffRole("staff");
        Mockito.when(staffMapper.selectById(other)).thenReturn(worker);
        Mockito.when(wageMapper.selectById("r-1")).thenReturn(record("r-1", "2026-08-01", "40.00", SETTLE));

        Result<?> res = (Result<?>) controller.wageSave(
                "r-1", other, "2026-08-01", "10:00", "18:00", "20", null, null, null, null, asManager());
        assertEquals(1, res.getCode());
        assertEquals("已结清的记录不能改到别人名下，请先删除再重新记账", res.getMsg());
        Mockito.verifyNoInteractions(settlementMapper);
    }

    /**
     * **改**（不是删）一条已结清的记录：凭据同样要重算。
     *
     * 这条和删除那条是两条独立的路径——`wageSave` 和 `wageDelete` 各自调用重算，
     * 漏掉任何一处，凭据都会在那条路径上悄悄失真。上一版代码里这两处是两句一模一样的
     * 「已结清不可修改/不可删除」，删掉守卫的时候很容易只补一边。
     *
     * 原始数据：一批两条 40 + 50 = 90。把 r-1 从 40 改成 10 小时 × $12 = 120，
     * 重算后凭据应为 120 + 50 = 170、两条。
     */
    @Test
    void editingSettledRecord_recomputesVoucher() {
        BbqStaff worker = new BbqStaff();
        worker.setUserId(STAFF);
        worker.setStaffRole("staff");
        Mockito.when(staffMapper.selectById(STAFF)).thenReturn(worker);
        Mockito.when(wageMapper.selectById("r-1")).thenReturn(record("r-1", "2026-08-01", "40.00", SETTLE));
        Mockito.when(wageMapper.selectCount(ArgumentMatchers.any())).thenReturn(0);
        // 保存后重算时查到的「这批还剩谁」——r-1 已是新金额 120
        Mockito.when(wageMapper.selectList(ArgumentMatchers.any())).thenReturn(new ArrayList<>(Arrays.asList(
                record("r-1", "2026-08-01", "120.00", SETTLE),
                record("r-2", "2026-08-02", "50.00", SETTLE))));
        Mockito.when(settlementMapper.selectById(SETTLE)).thenReturn(voucher("90.00", 2, "2026-08-01", "2026-08-02"));

        // 08:00-18:00 共 10 小时，不吃饭，时薪 12 → 120.00
        Result<?> res = (Result<?>) controller.wageSave(
                "r-1", STAFF, "2026-08-01", "08:00", "18:00", "12", null, null, null, null, asManager());
        assertEquals(0, res.getCode(), res.getMsg());

        ArgumentCaptor<BbqSettlement> cap = ArgumentCaptor.forClass(BbqSettlement.class);
        Mockito.verify(settlementMapper).updateById(cap.capture());
        assertEquals(0, new BigDecimal("170.00").compareTo(cap.getValue().getAmount()));
        assertEquals(2, cap.getValue().getRecordCount());
    }
}
