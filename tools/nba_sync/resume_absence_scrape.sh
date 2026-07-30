#!/bin/sh
# 等 B-R 的限流解除，然后把 2026 赛季重爬完（为了拿未出场名单）。
#
# 为什么先探再爬：限流被触发之后，直接开跑只会把封延长——每个 429 都算一次请求。
# 所以先用**一个**请求确认解封了没有，没解就再等一刻钟，最多等两小时。
#
# 停掉它：pkill -f resume_absence_scrape
set -u
cd "$(dirname "$0")" || exit 1

PROBE='https://www.basketball-reference.com/boxscores/202606130SAS.html'
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

echo "=== 等 60 分钟让限流过期 $(date) ==="
sleep 3600

i=0
while [ $i -lt 8 ]; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$PROBE")
    echo "探测 $(date +%H:%M:%S) -> HTTP $code"
    [ "$code" = "200" ] && break
    i=$((i + 1))
    echo "  仍被限流，再等 15 分钟（第 $i/8 次）"
    sleep 900
done

if [ "$code" != "200" ]; then
    echo "=== 两小时后仍未解封，放弃本次自动重试 $(date) ==="
    exit 1
fi

echo "=== 已解封，补 2026 季后赛缺的 3 场 $(date) ==="
python3 patch_po_missing.py || echo "!! 季后赛补漏失败，常规赛照跑"

echo "=== 2026 常规赛重爬 $(date) ==="
python3 rs_game_logs_br.py --scrape --seasons 2026

echo "=== 全部完成 $(date) ==="
