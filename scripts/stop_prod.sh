#!/usr/bin/env bash
set -euo pipefail
LOG_DIR=${LOG_DIR:-logs}
PID_FILE="$LOG_DIR/mcp_server.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  echo "Found PID $PID; attempting graceful shutdown..."
  if [ -n "${MCP_SHUTDOWN_TOKEN:-}" ]; then
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS -X POST -H "Authorization: Bearer $MCP_SHUTDOWN_TOKEN" "http://localhost:${PORT:-8005}/shutdown"; then
        echo "Shutdown endpoint accepted request. Waiting..."
        sleep 2
        if kill -0 "$PID" >/dev/null 2>&1; then
          kill "$PID" || true
        fi
      else
        echo "Shutdown endpoint failed; killing PID $PID" >&2
        kill -9 "$PID" || true
      fi
    else
      echo "curl missing; killing PID $PID" >&2
      kill -9 "$PID" || true
    fi
  else
    echo "No shutdown token; killing PID $PID" >&2
    kill -9 "$PID" || true
  fi
  rm -f "$PID_FILE"
else
  echo "PID file not found at $PID_FILE; nothing to do"
fi

echo "Stop script done."