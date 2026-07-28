package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;

/**
 * 按用户开关的功能模块。规则写在这里一处，接口侧只挂 {@link RequiresFeature}。
 *
 * 两种语义要分清：
 *  · **默认开**（百家说、新闻、私信、日程）：没设置过就是能用，超管显式关掉才不能用；
 *  · **默认关**（NBA 数据）：没设置过就是**不能用**，超管在用户管理里逐个放行。
 * 目前只有 NBA 走默认关，所以这个枚举只有一项——加新的默认关模块时往这里加。
 */
public enum Feature {

    /**
     * NBA 数据模块（dream_user.FEAT_DATA）：联盟概览 / 数据概览 / 联盟排行 / 历史数据 / 球员对比。
     * 必须登录，且必须被超管放行（值为 '1'）。空值、'0' 都算没放行。
     */
    NBA_DATA {
        @Override
        public boolean granted(DreamUser user) {
            return user != null && "1".equals(user.getFeatData());
        }
    };

    /** 该用户是否被放行。调用方负责先确认已登录、以及超管豁免。 */
    public abstract boolean granted(DreamUser user);
}
