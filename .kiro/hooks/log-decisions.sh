#!/bin/bash
# Auto-append decision log entries from AI responses
# Triggered by Kiro CLI's "stop" hook after each AI turn

set -e

# Read hook event from stdin
EVENT=$(cat)

# Extract assistant response
RESPONSE=$(echo "$EVENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('assistant_response', ''))
" 2>/dev/null) || exit 0

# Only log if response contains decision markers
# Look for patterns that indicate a technical decision was made
if echo "$RESPONSE" | grep -qiE '(改[了用成]|换成|去掉|新增|删除|重写|修复|决策|方案|原因|因为.*所以|从.*改为|replaced|switched|removed|added|rewrote|fixed|decision|because)'; then

  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  LOG_FILE="$REPO_ROOT/docs/decision-log.md"
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

  # Extract a one-line summary (first line that looks like a decision)
  SUMMARY=$(echo "$RESPONSE" | grep -iE '(改[了用成]|换成|去掉|新增|删除|重写|修复|从.*改|replaced|switched|removed|added|rewrote|fixed)' | head -1 | sed 's/^[[:space:]-]*//' | cut -c1-120)

  # Skip if summary is empty or too short
  [ ${#SUMMARY} -lt 10 ] && exit 0

  # Create log file with header if it doesn't exist
  if [ ! -f "$LOG_FILE" ]; then
    mkdir -p "$(dirname "$LOG_FILE")"
    cat > "$LOG_FILE" << 'HEADER'
# 决策日志 / Decision Log

> 由 AI 对话自动记录。每条记录包含时间戳和决策摘要。
> Auto-logged from AI conversations. Each entry has a timestamp and decision summary.

---

HEADER
  fi

  # Append entry
  echo "### $TIMESTAMP" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
  echo "$SUMMARY" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
fi

exit 0
