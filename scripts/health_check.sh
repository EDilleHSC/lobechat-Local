#!/usr/bin/env bash
# Poll /health until it succeeds or max attempts reached; then show last lines of the log
set -euo pipefail
PORT=${PORT:-8005}
LOG_DIR=${LOG_DIR:-logs}
INTERVAL=${INTERVAL:-3}
MAX_ATTEMPTS=${MAX_ATTEMPTS:-20}

attempt=0
while [ $attempt -lt $MAX_ATTEMPTS ]; do
  attempt=$((attempt+1))
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then
      echo "Health OK"
      # tail last 200 lines
      tail -n 200 "$LOG_DIR"/mcp_server_*.log || true
      exit 0
    else
      echo "Health check attempt $attempt/$MAX_ATTEMPTS failed; retrying in $INTERVAL s..."
      sleep $INTERVAL
    fi
  else
    echo "curl not found; cannot poll health" >&2
    exit 2
  fi
done

echo "Health check did not succeed after $MAX_ATTEMPTS attempts" >&2
ls -lt "$LOG_DIR" || true
exit 1