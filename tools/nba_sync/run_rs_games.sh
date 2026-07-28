#!/bin/bash
# Regular-season per-game box scores, newest season first.
#
# Two phases, both resumable, both safe to re-run: the index is cached per season and the
# box crawl appends one JSON line per game. Killing this script costs at most one request.
#
#   ./run_rs_games.sh              1947-2026
#   ./run_rs_games.sh 2000 2026    a slice
#
# Progress at any time:  python3 rs_game_logs_br.py --status
cd "$(dirname "$0")" || exit 1

LO=${1:-1947}
HI=${2:-2026}
LOG=rs_crawl.log

echo "=== $(date '+%F %T')  index $LO-$HI ===" >> "$LOG"
python3 rs_game_logs_br.py --index --seasons "$LO-$HI" --newest-first >> "$LOG" 2>&1

echo "=== $(date '+%F %T')  scrape $LO-$HI ===" >> "$LOG"
python3 rs_game_logs_br.py --scrape --seasons "$LO-$HI" --newest-first >> "$LOG" 2>&1

echo "=== $(date '+%F %T')  done ===" >> "$LOG"
