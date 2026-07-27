#!/bin/bash
# Playoff box scores, NEWEST SEASON FIRST, applied to the DB after every season.
# The Mac is leaving, so nothing may depend on the whole run finishing: whatever
# season completes is already queryable, and an interrupted season costs at most
# that one season (its cache is written only when the season finishes).
cd /Users/epoch/IdeaProjects/basketball/tools/nba_sync || exit 1
for y in $(seq 2026 -1 1977); do
  echo "########## $y ##########"
  python3 po_game_logs_br.py --scrape --seasons "$y" || continue
  python3 po_game_logs_br.py --build  --seasons "$y" || continue
  echo "########## $y LIVE ##########"
done
echo "===== ALL DONE ====="
