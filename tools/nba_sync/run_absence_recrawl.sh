#!/bin/bash
# Re-crawl 2000-2025 regular seasons so the box caches carry absence lists, then rebuild
# each season into the DB and regenerate its zero-appearance rows.
#
# Per season, newest first:   move old cache aside -> scrape -> build -> 0-row pass
#
# Resumable at every level: finished seasons are recorded in absence_recrawl.done and
# skipped; a season interrupted mid-scrape keeps its partial cache (the aside-move only
# happens once, guarded by the .bak file's existence) and the next run resumes it.
# The whole list is walked up to three passes so seasons left incomplete by 429 bursts
# get retried cheaply — by then almost everything hits the cache and is skipped.
#
# Run it detached:  setsid nohup ./run_absence_recrawl.sh > /dev/null 2>&1 &
# Watch it:         tail -f absence_recrawl.log
cd "$(dirname "$0")" || exit 1

LOG=absence_recrawl.log
DONE=absence_recrawl.done
touch "$DONE"

index_count() {
  python3 - "$1" <<'PY'
import json, sys
try:
    print(len(json.load(open(f'rs_index_cache/{sys.argv[1]}.json'))['games']))
except Exception:
    print(0)
PY
}

for pass in 1 2 3; do
  remaining=0
  for year in $(seq 2025 -1 2000); do
    grep -qx "$year" "$DONE" && continue
    remaining=$((remaining + 1))
    f="rs_games_cache/${year}.jsonl"
    bak="rs_games_cache/${year}.jsonl.bak-noabsent"
    # 老缓存只挪一次：.bak 已存在说明这一季已经开始重爬，当前文件是新进度，别动它
    if [ -f "$f" ] && [ ! -f "$bak" ]; then
      mv "$f" "$bak"
      echo "== $year: old cache -> $(basename "$bak")" >> "$LOG"
    fi
    echo "== $(date '+%F %T') pass$pass scrape $year ==" >> "$LOG"
    python3 rs_game_logs_br.py --scrape --seasons "$year" >> "$LOG" 2>&1

    want=$(index_count "$year")
    got=$(wc -l < "$f" 2>/dev/null || echo 0)
    if [ "$want" -eq 0 ] || [ "$got" -lt "$want" ]; then
      echo "!! $year incomplete after pass$pass: $got/$want — retry on next pass" >> "$LOG"
      continue
    fi

    echo "== $(date '+%F %T') build $year ==" >> "$LOG"
    if python3 rs_game_logs_br.py --build --seasons "$year" >> "$LOG" 2>&1 \
       && python3 absence_roster_rows.py --season "$year" >> "$LOG" 2>&1; then
      echo "$year" >> "$DONE"
      echo "== $year DONE ==" >> "$LOG"
    else
      echo "!! $year build/0-row FAILED — retry on next pass" >> "$LOG"
    fi
  done
  [ "$remaining" -eq 0 ] && break
done

echo "== $(date '+%F %T') ALL FINISHED ($(wc -l < "$DONE")/26 seasons) ==" >> "$LOG"
