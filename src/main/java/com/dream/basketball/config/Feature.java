package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;

/**
 * 按用户开关的功能模块。规则写在这里一处，接口侧只挂 {@link RequiresFeature}。
 *
 * 两种语义要分清：
 *  · **默认开**（百家说、新闻、私信、日程）：没设置过就是能用，超管显式关掉才不能用；
 *  · **必须登录 + 默认放行 + 可按人封禁**（NBA 数据）：介于两者之间的第三档——
 *    游客不行（挡爬虫），登录了就能用（不用等审批），超管仍可对个别人写 '0' 封掉。
 * 目前只有 NBA 走这一档，所以这个枚举只有一项。
 */
public enum Feature {

    /**
     * NBA 数据模块（dream_user.FEAT_DATA）：联盟概览 / 数据概览 / 联盟排行 / 每日赛场 /
     * 历史数据 / 球员对比。
     *
     * **必须登录，默认放行，超管可以按人封禁（值为 '0'）。** 空值 = 没设置过 = 能用。
     *
     * 这里原本是「默认关、逐个放行」，改掉是因为菜单入口挪进了 NBA 专题：想看的人自己
     * 点进专题就能用，不该再卡一道人工审批。登录这道门保留——匿名放开等于把逐场
     * 数据敞开给爬虫。
     *
     * 翻转语义时库里那 5 个显式 '0' 一并清成了 NULL：旧语义下 '0' 和 NULL 是一回事
     * （都是没放行），照搬过去会把 5 个从未被刻意封禁的人无声封掉。
     */
    NBA_DATA {
        @Override
        public boolean granted(DreamUser user) {
            return user != null && !"0".equals(user.getFeatData());
        }
    };

    /** 该用户是否被放行。调用方负责先确认已登录、以及超管豁免。 */
    public abstract boolean granted(DreamUser user);
}
