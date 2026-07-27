#!/bin/bash
# Re-sync the ESPN-era seasons after the <15-game filter was removed.
# 2011 is already done; 1994-2026 minus that. Each season is DELETE+INSERT scoped to
# itself, so a failure stops that season only and the rest still run.
cd /Users/epoch/IdeaProjects/basketball/tools/nba_sync || exit 1
DONE=" 1994 1995 1996 1997 1998 1999 2000 2001 2002 2003 2004 2005 2006 2007 2008 2009 2010 2011 2012 "
for y in $(seq 1994 2026); do
  case "$DONE" in *" $y "*) continue;; esac
  echo "########## $y ##########"
  python3 sync.py --season "$y" 2>&1 | grep -E "players:|DONE|ABORT|ERROR|Duplicate" 
done
echo "===== RESYNC DONE ====="
