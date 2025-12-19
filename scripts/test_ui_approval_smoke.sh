#!/usr/bin/env bash
set -euo pipefail
TOKEN="${MCP_APPROVAL_TOKEN:-$1}"
if [ -z "$TOKEN" ]; then
  echo "MCP_APPROVAL_TOKEN not provided. Set env var or pass token as first arg" >&2
  exit 2
fi
SERVER="http://localhost:8005"
PAYLOAD=$(jq -n '{approvedBy: "test-ui", date: (now | todateiso8601), role: "automation", notes: "UI smoke test approval", checklist: {layout: true, accessibility: true, bugFixed: false, production: false}, status: "approved"}')
RES=$(curl -sS -w "%{http_code}" -H "Content-Type: application/json" -H "X-MCP-APPROVAL-TOKEN: $TOKEN" -d "$PAYLOAD" "$SERVER/approval")
HTTP=${RES: -3}
BODY=${RES:0:${#RES}-3}
if [ "$HTTP" != "201" ]; then
  echo "Approval POST failed: HTTP $HTTP - $BODY" >&2
  exit 3
fi
FILE=$(echo "$BODY" | jq -r .file)
if [ -z "$FILE" ] || [ "$FILE" = "null" ]; then
  echo "Approval response missing file field: $BODY" >&2
  exit 4
fi
if [ ! -f "$FILE" ]; then
  echo "Persisted approval file not found: $FILE" >&2
  exit 5
fi
AUDIT_DIR="D:/05_AGENTS-AI/01_RUNTIME/VBoarder/NAVI/approvals"
AUDIT="$AUDIT_DIR/audit.log"
if [ ! -f "$AUDIT" ]; then
  echo "Audit log not found: $AUDIT" >&2
  exit 6
fi
if ! tail -n 20 "$AUDIT" | grep -F "$(basename "$FILE")" >/dev/null; then
  echo "Audit log does not reference persisted approval file. Tail of audit.log:" >&2
  tail -n 20 "$AUDIT" >&2
  exit 7
fi
echo "TEST PASSED: UI approval persisted and audit logged"
exit 0