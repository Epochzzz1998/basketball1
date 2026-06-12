package com.dream.basketball.common;

/**
 * Unified pagination payload (P4-2): {total, records}. Carried as the {@code data}
 * of a {@link Result}. Replaces the old layui {code,count,data} table shape.
 */
public class PageResult {

    private long total;
    private Object records;

    public PageResult() {
    }

    public PageResult(long total, Object records) {
        this.total = total;
        this.records = records;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public Object getRecords() {
        return records;
    }

    public void setRecords(Object records) {
        this.records = records;
    }
}
