#!/usr/bin/env bash
# Lightweight shutdown smoke test (bash)
# NOTE: This script assumes it's running on Windows (via WSL/Cygwin) or a system where node server path is available.
set -euo pipefail
PORT=${1:-8005}
SHUTDOWN_TOKEN=${2:-TEST_SHUTDOWN}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_PATH="$SCRIPT_DIR/../runtime/triage_20251216_172245/mcp_server.js"
if [ ! -f "$SERVER_PATH" ]; then
  echo "Server file not found: $SERVER_PATH" >&2
  exit 2
fi

export ENABLE_TEST_ADMIN=1
export MCP_SHUTDOWN_TOKEN="$SHUTDOWN_TOKEN"

# Start server
node "$SERVER_PATH" &
SERVER_PID=$!

echo "Started server PID $SERVER_PID"

# Wait for /health
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "Server healthy"
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "Server did not become healthy" >&2
    kill -9 $SERVER_PID || true
    exit 2
  fi
done

PID_FILE="$(dirname "$SERVER_PATH")/mcp_server.pid"
if [ ! -f "$PID_FILE" ]; then
  echo "PID file missing: $PID_FILE" >&2
  kill -9 $SERVER_PID || true
  exit 2
fi

# Call shutdown
resp=$(curl -fsS -X POST "http://localhost:$PORT/__mcp_shutdown?token=$SHUTDOWN_TOKEN" || true)
if [[ "$resp" != *"Shutting down"* ]]; then
  echo "Unexpected shutdown response: $resp" >&2
  exit 2
fi

# Wait for pid removal
for i in $(seq 1 10); do
  if [ ! -f "$PID_FILE" ]; then
    echo "PID removed"
    break
  fi
  sleep 1
  if [ "$i" -eq 10 ]; then
    echo "PID file still present after shutdown" >&2
    exit 2
  fi
done

# Confirm port closed
if nc -z localhost $PORT 2>/dev/null; then
  echo "Port $PORT still open" >&2
  exit 2
fi

echo "TEST PASSED: shutdown smoke"
exit 0
