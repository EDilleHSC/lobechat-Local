#!/usr/bin/env bash
set -euo pipefail

PORT=${PORT:-8005}
LOG_DIR=${LOG_DIR:-logs}
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
STDOUT_LOG="$LOG_DIR/mcp_server_$TIMESTAMP.log"
STDERR_LOG="$LOG_DIR/mcp_server_$TIMESTAMP.err.log"
PID_FILE="$LOG_DIR/mcp_server.pid"

# find server
if [ -f runtime/triage_server/mcp_server.js ]; then
  SERVER=runtime/triage_server/mcp_server.js
elif [ -f runtime/mcp_server.js ]; then
  SERVER=runtime/mcp_server.js
elif [ -f mcp_server.js ]; then
  SERVER=mcp_server.js
else
  echo "mcp_server.js not found in expected locations" >&2
  exit 1
fi

echo "Starting MCP server: $SERVER on port $PORT"
nohup node "$SERVER" >"$STDOUT_LOG" 2>"$STDERR_LOG" &
PID=$!
echo $PID > "$PID_FILE"

echo "Started (PID: $PID). Logs: $STDOUT_LOG (stdout), $STDERR_LOG (stderr)"
# brief health check
sleep 2
if command -v curl >/dev/null 2>&1; then
  if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "Health OK"
  else
    echo "Health check failed; check logs" >&2
  fi
fi

echo "Start script done. Use scripts/stop_prod.sh to stop."