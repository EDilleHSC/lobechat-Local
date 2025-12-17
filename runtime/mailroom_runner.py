#!/usr/bin/env python3
"""Simple mailroom runner stub for Beta-1.

Behavior:
- Finds the latest snapshot file under NAVI/snapshots/inbox
- For each item listed, copies it from NAVI/inbox/<name> to NAVI/agents/agent1/inbox/
- Outputs a short JSON to stdout with routing metadata
"""
import json
import os
import shutil
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SNAPSHOT_DIR = os.path.join(ROOT, 'NAVI', 'snapshots', 'inbox')
INBOX_DIR = os.path.join(ROOT, 'NAVI', 'inbox')
AGENT_DIR = os.path.join(ROOT, 'NAVI', 'agents', 'agent1', 'inbox')

os.makedirs(AGENT_DIR, exist_ok=True)

def latest_snapshot():
    try:
        files = [f for f in os.listdir(SNAPSHOT_DIR) if f.endswith('.json')]
    except Exception:
        return None
    if not files:
        return None
    files.sort()
    return os.path.join(SNAPSHOT_DIR, files[-1])

def load_snapshot(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def route_snapshot(snap):
    routed = []
    for item in snap.get('items', []):
        name = item.get('name')
        src = os.path.join(INBOX_DIR, name)
        if os.path.exists(src):
            dst = os.path.join(AGENT_DIR, name)
            try:
                shutil.copy2(src, dst)
                routed.append(name)
            except Exception:
                pass
    return routed

def main():
    snap_file = latest_snapshot()
    if not snap_file:
        print(json.dumps({'routed_to': 'agent1', 'routed_files': [], 'snapshot': None}))
        return
    snap = load_snapshot(snap_file)
    routed = route_snapshot(snap)
    out = {
        'routed_to': 'agent1',
        'routed_files': routed,
        'snapshot': os.path.basename(snap_file),
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }
    print(json.dumps(out))

if __name__ == '__main__':
    main()
