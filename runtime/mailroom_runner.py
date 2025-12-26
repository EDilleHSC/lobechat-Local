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
from datetime import datetime, timezone

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

    # Load optional routing config to map function -> office when needed
    cfg_path = os.path.join(ROOT, 'NAVI', 'config', 'routing_config.json')
    function_to_office = {}
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, 'r', encoding='utf-8') as c:
                cfg = json.load(c)
                function_to_office = cfg.get('function_to_office', {}) or {}
        except Exception:
            function_to_office = {}

    # Helper: find file either in INBOX or processed/* directories (prefers processed newest)
    def find_file(name):
        # Check processed dirs (newest first)
        proc_root = os.path.join(ROOT, 'NAVI', 'processed')
        if os.path.exists(proc_root):
            # list dirs sorted desc
            dirs = sorted([d for d in os.listdir(proc_root) if os.path.isdir(os.path.join(proc_root, d))], reverse=True)
            for d in dirs:
                p = os.path.join(proc_root, d, name)
                if os.path.exists(p):
                    return p
        # Fallback to INBOX
        p = os.path.join(INBOX_DIR, name)
        if os.path.exists(p):
            return p
        return None

    for item in snap.get('items', []):
        name = item.get('name')
        src = find_file(name)
        if not src:
            # file not found where expected; skip
            continue

        # sidecar may live next to file (e.g., src + '.navi.json')
        sidecar = src + '.navi.json'
        route = None
        if os.path.exists(sidecar):
            try:
                with open(sidecar, 'r', encoding='utf-8') as s:
                    sc = json.load(s)
                    route = sc.get('route') or sc.get('function') or None
            except Exception:
                route = None

        dest = None
        # If route is present, map it to an office inbox
        if route:
            # Normalize route: if dotted like 'LHI.Finance' prefer last segment
            if '.' in route:
                route_part = route.split('.')[-1]
            else:
                route_part = route
            # If route_part matches an existing office dir, use it
            office_dir = os.path.join(ROOT, 'NAVI', 'offices', route_part)
            if os.path.exists(office_dir):
                dest = os.path.join(office_dir, 'inbox')
            else:
                # Try mapping function -> office via config
                mapped = function_to_office.get(route_part)
                if mapped:
                    dest = os.path.join(ROOT, 'NAVI', 'offices', mapped, 'inbox')
                else:
                    # Last resort: if route looks like a known office name, use it; otherwise fallback to agent1
                    fallback_office = route_part if os.path.exists(os.path.join(ROOT, 'NAVI', 'offices', route_part)) else None
                    if fallback_office:
                        dest = os.path.join(ROOT, 'NAVI', 'offices', fallback_office, 'inbox')

        # If we still don't have a dest, fallback to previous agent1 behavior
        if not dest:
            dest = AGENT_DIR

        try:
            os.makedirs(dest, exist_ok=True)
            dst = os.path.join(dest, os.path.basename(src))
            shutil.copy2(src, dst)
            # also copy sidecar if present
            if os.path.exists(sidecar):
                try:
                    shutil.copy2(sidecar, dst + '.navi.json')
                except Exception:
                    pass
            routed.append(os.path.basename(dst))
        except Exception:
            pass

    # Fallback: if snapshot did not contain items that are sitting in processed/*, attempt to route them
    processed_root = os.path.join(ROOT, 'NAVI', 'processed')
    if os.path.exists(processed_root):
        # Walk processed subdirs
        for sub in sorted([d for d in os.listdir(processed_root) if os.path.isdir(os.path.join(processed_root, d))], reverse=True):
            subdir = os.path.join(processed_root, sub)
            for fname in os.listdir(subdir):
                if fname.endswith('.navi.json'):
                    sidecar_path = os.path.join(subdir, fname)
                    base = fname[:-len('.navi.json')]
                    # Avoid re-routing files already processed above
                    if base in routed:
                        continue
                    src = os.path.join(subdir, base)
                    if not os.path.exists(src):
                        continue
                    # read route
                    try:
                        with open(sidecar_path, 'r', encoding='utf-8') as s:
                            sc = json.load(s)
                            route = sc.get('route') or sc.get('function') or None
                    except Exception:
                        route = None

                    dest = None
                    if route:
                        if '.' in route:
                            route_part = route.split('.')[-1]
                        else:
                            route_part = route
                        office_dir = os.path.join(ROOT, 'NAVI', 'offices', route_part)
                        if os.path.exists(office_dir):
                            dest = os.path.join(office_dir, 'inbox')
                        else:
                            mapped = function_to_office.get(route_part)
                            if mapped:
                                dest = os.path.join(ROOT, 'NAVI', 'offices', mapped, 'inbox')
                    if not dest:
                        dest = AGENT_DIR

                    try:
                        os.makedirs(dest, exist_ok=True)
                        dst = os.path.join(dest, os.path.basename(src))
                        shutil.copy2(src, dst)
                        # copy sidecar
                        shutil.copy2(sidecar_path, dst + '.navi.json')
                        routed.append(os.path.basename(dst))
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
        'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    }
    print(json.dumps(out))

if __name__ == '__main__':
    main()
