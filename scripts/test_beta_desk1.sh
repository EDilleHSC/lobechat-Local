#!/usr/bin/env bash
set -euo pipefail

# Deterministic acceptance test for Desk v1
# Usage: ./scripts/test_beta_desk1.sh --token TEST_APPROVAL

PORT=${PORT:-8005}
TOKEN=${TOKEN:-${MCP_APPROVAL_TOKEN:-}}
WAIT_SECONDS=${WAIT_SECONDS:-30}
NO_CLEANUP=${NO_CLEANUP:-0}

if [ -z "${TOKEN:-}" ]; then
  echo "ERROR: MCP_APPROVAL_TOKEN not set. Export or pass --token." >&2
  exit 2
fi
export MCP_APPROVAL_TOKEN="$TOKEN"

# Enforce repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || { echo "Failed to cd to repo root" >&2; exit 1; }

if [ ! -f 'runtime/triage_20251216_172245/mcp_server.js' ]; then
  echo "ERROR: mcp_server.js not found at runtime/triage_20251216_172245/mcp_server.js" >&2
  exit 1
fi

check_health() {
  if curl -sS "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

MCP_PID=""
if ! check_health; then
  echo "Starting server in background..."
  mkdir -p NAVI/logs
  node runtime/triage_20251216_172245/mcp_server.js > NAVI/logs/mcp_server-test_beta_desk1.out.log 2> NAVI/logs/mcp_server-test_beta_desk1.err.log &
  MCP_PID=$!
  echo "Started node PID: ${MCP_PID}"
  for i in $(seq 1 ${WAIT_SECONDS}); do
    if check_health; then echo "/health OK"; break; fi
    sleep 1
  done
  if ! check_health; then echo "Server did not become healthy" >&2; tail -n 200 NAVI/logs/mcp_server-test_beta_desk1.err.log; exit 3; fi
else
  echo "Server already healthy"
fi

# Create sample file
mkdir -p NAVI/inbox
SAMPLE="NAVI/inbox/test_beta_desk1-$(date -u +%Y%m%d-%H%M%S).txt"
echo "beta day0 test" > "$SAMPLE"
echo "Wrote sample file: $SAMPLE"

# Trigger /process
echo "Triggering /process..."
HTTP=$(curl -sS -w "%{http_code}" -X POST "http://localhost:${PORT}/process" -o /tmp/test_beta_desk1.process.out || true)
if [ "$HTTP" != "200" ]; then
  echo "ERROR: /process returned HTTP $HTTP" >&2; cat /tmp/test_beta_desk1.process.out; exit 4
fi
cat /tmp/test_beta_desk1.process.out

sleep 1
# Find latest snapshot
SNAP=$(ls -1t NAVI/snapshots/inbox/*.json 2>/dev/null | head -n1 || true)
if [ -z "$SNAP" ]; then echo "No snapshot found" >&2; exit 5; fi
SNAPNAME=$(basename "$SNAP")
echo "Found snapshot: $SNAPNAME"

# Submit approval
PAYLOAD=$(jq -n --arg ab "test-beta-desk1" --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg notes "snapshot_id: $SNAPNAME; files: [$(basename $SAMPLE)]" '{approvedBy:$ab, status:"approved", checklist:{layout:true, accessibility:true, bugFixed:false, production:false}, date:$date, notes:$notes}')
echo "Submitting approval..."
RESP=$(curl -sS -X POST "http://localhost:${PORT}/approval" -H "Content-Type: application/json" -H "X-MCP-APPROVAL-TOKEN: ${TOKEN}" -d "$PAYLOAD")
if [ -z "$RESP" ]; then echo "Approval POST failed" >&2; exit 6; fi
echo "Approval response: $RESP"

# Extract file path
FILE=$(echo "$RESP" | jq -r .file)
if [ ! -f "$FILE" ]; then echo "Approval file not found: $FILE" >&2; exit 7; fi
echo "Approval file exists: $FILE"

# Check audit
if [ ! -f NAVI/approvals/audit.log ]; then echo "No audit.log" >&2; exit 8; fi
tail -n 5 NAVI/approvals/audit.log

echo "Cleaning up sample file"
if [ "$NO_CLEANUP" -eq 0 ]; then rm -f "$SAMPLE"; fi

if [ -n "$MCP_PID" ]; then echo "Stopping server PID $MCP_PID"; kill "$MCP_PID" >/dev/null 2>&1 || true; fi

echo "TEST PASSED: approval persisted and audit logged"
exit 0
