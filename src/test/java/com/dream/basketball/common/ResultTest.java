package com.dream.basketball.common;

import com.dream.basketball.utils.BaseUtils;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** P4-2: unified response envelope + that BaseUtils helpers now emit it. */
class ResultTest {

    @Test
    void factories_setExpectedCodes() {
        assertEquals(0, Result.ok().getCode());
        assertEquals(0, Result.ok("data").getCode());
        assertEquals("data", Result.ok("data").getData());
        assertEquals(0, Result.ok("hi", 5).getCode());
        assertEquals("hi", Result.ok("hi", 5).getMsg());
        assertEquals(-1, Result.fail("boom").getCode());
        assertEquals(500, Result.fail(500, "x").getCode());
        assertNull(Result.fail("boom").getData());
    }

    @Test
    void handlerResultJson_emitsUnifiedResult() {
        BaseUtils u = new BaseUtils();
        Result<?> ok = (Result<?>) u.handlerResultJson(true, "登录成功");
        assertEquals(0, ok.getCode());
        assertEquals("登录成功", ok.getMsg());

        Result<?> bad = (Result<?>) u.handlerResultJson(false, "验证码错误");
        assertEquals(-1, bad.getCode());
        assertEquals("验证码错误", bad.getMsg());
    }

    @Test
    void handlerSuccessPageJson_wrapsPageResult() {
        BaseUtils u = new BaseUtils();
        List<String> rows = Arrays.asList("a", "b", "c");
        Result<?> r = (Result<?>) u.handlerSuccessPageJson(0, "ok", 42, rows);
        assertEquals(0, r.getCode());
        assertEquals("ok", r.getMsg());
        assertInstanceOf(PageResult.class, r.getData());
        PageResult page = (PageResult) r.getData();
        assertEquals(42, page.getTotal());
        assertEquals(rows, page.getRecords());
    }
}
