package com.dream.basketball.job;

import com.dream.basketball.service.LolSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 开黑战绩的定时抓取。
 *
 * <h2>为什么是 fixedDelay 而不是 cron</h2>
 *
 * {@code fixedDelay} 是「上一轮**跑完**之后再等 N 分钟」，天然不会重叠。
 * cron 是按墙上时钟触发的，一旦某一轮赶上首次回填（几百次请求、十几分钟），
 * 下一次照样会启动，两轮同时打 Riot 就会把限流吃穿。
 *
 * <h2>为什么 5 分钟</h2>
 *
 * 20 个账号按 5 分钟一轮，只占配额的 8%，余量充足。再密没有意义：
 * 战绩晚几分钟入库没有任何人会察觉，这些数据的主要消费者是第二天早上那条汇总。
 *
 * <h2>为什么不做「刚打完就提频」这类优化</h2>
 *
 * 省下来的配额没有用处，而多出来的状态机是真的要维护。
 * 限流预算充裕的时候，最省事的调度就是最好的调度。
 */
@Component
public class LolSyncJob {

    private static final Logger log = LoggerFactory.getLogger(LolSyncJob.class);

    /** 启动后先等 2 分钟：让应用先把自己启起来，别和启动时的其它初始化抢资源 */
    private static final long INITIAL_DELAY_MS = 2 * 60 * 1000L;
    private static final long INTERVAL_MS = 5 * 60 * 1000L;

    @Autowired
    private LolSyncService sync;

    @Scheduled(initialDelay = INITIAL_DELAY_MS, fixedDelay = INTERVAL_MS)
    public void run() {
        try {
            LolSyncService.SyncReport r = sync.runOnce();
            if (r.getSkipped() != null) {
                return;                       // 没配 key：静默跳过，不要每 5 分钟刷一条日志
            }
            boolean worth = r.getBackfilled() > 0 || r.getPolled() > 0
                    || r.getScanned() > 0 || r.getRanksFilled() > 0 || !r.getErrors().isEmpty();
            if (worth) {
                log.info("LoL 同步：回填 {} 场，新增 {} 场，补扫 {} 场，补段位 {} 人（还差 {}）{}",
                        r.getBackfilled(), r.getPolled(), r.getScanned(),
                        r.getRanksFilled(), r.getRanksPending(),
                        r.getErrors().isEmpty() ? "" : "，错误 " + r.getErrors());
            }
        } catch (Exception e) {
            // 定时任务里抛出去的异常会让 Spring 停掉后续调度，必须在这里兜住
            log.error("LoL 同步这一轮失败", e);
        }
    }
}
