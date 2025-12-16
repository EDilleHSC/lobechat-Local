#!/usr/bin/env python3
"""
VBoarder NAVI Status Monitor
Provides health signals and system status
"""

import json
import os
from pathlib import Path
from datetime import datetime

# Configuration
NAVI_DIR = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
SNAPSHOT_DIR = os.path.join(NAVI_DIR, "snapshots", "inbox")

def count_files(folder):
    """Count files in a directory"""
    folder_path = os.path.join(NAVI_DIR, folder)
    if not os.path.exists(folder_path):
        return 0
    return len([f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))])

def last_snapshot_time():
    """Get timestamp of most recent snapshot"""
    if not os.path.exists(SNAPSHOT_DIR):
        return None

    snapshots = [f for f in os.listdir(SNAPSHOT_DIR) if f.endswith('.json')]
    if not snapshots:
        return None

    # Get most recent snapshot
    snapshots.sort(reverse=True)
    latest_snapshot = os.path.join(SNAPSHOT_DIR, snapshots[0])

    try:
        return os.path.getmtime(latest_snapshot)
    except Exception:
        return None

def get_system_health():
    """Determine overall system health"""
    inbox_count = count_files("inbox")
    active_count = count_files("ACTIVE")
    waiting_count = count_files("WAITING")
    done_count = count_files("DONE")

    last_snapshot = last_snapshot_time()

    # Health rules
    issues = []

    if inbox_count > 0:
        issues.append("📥 Inbox has pending items")

    if last_snapshot:
        snapshot_age_minutes = (datetime.now().timestamp() - last_snapshot) / 60
        if snapshot_age_minutes > 5:
            issues.append(f"⚠️ Last snapshot is {snapshot_age_minutes:.1f} minutes old")
    else:
        issues.append("❌ No snapshots found")

    if active_count > 10:
        issues.append("⚠️ ACTIVE directory growing large")

    # Determine overall status
    if "❌" in str(issues):
        status = "🔴 CRITICAL"
    elif "📥" in str(issues) or snapshot_age_minutes > 10:
        status = "🟡 WARNING"
    else:
        status = "🟢 HEALTHY"

    return status, issues

def main():
    """Generate and display system status"""
    print("📊 VBoarder NAVI System Status")

    # Gather metrics
    inbox_count = count_files("inbox")
    active_count = count_files("ACTIVE")
    waiting_count = count_files("WAITING")
    done_count = count_files("DONE")

    last_snapshot = last_snapshot_time()

    # Create status object
    status = {
        "timestamp": datetime.now().isoformat(),
        "inbox_count": inbox_count,
        "active_count": active_count,
        "waiting_count": waiting_count,
        "done_count": done_count,
        "total_files": inbox_count + active_count + waiting_count + done_count,
        "last_snapshot": datetime.fromtimestamp(last_snapshot).isoformat() if last_snapshot else "none"
    }

    # Add health assessment
    health_status, issues = get_system_health()
    status["health"] = health_status
    status["issues"] = issues

    # Display status
    print(f"🕒 Timestamp: {status['timestamp']}")
    print(f"📥 Inbox: {status['inbox_count']} files")
    print(f"▶️  Active: {status['active_count']} files")
    print(f"⏸️  Waiting: {status['waiting_count']} files")
    print(f"✅ Done: {status['done_count']} files")
    print(f"📊 Total: {status['total_files']} files")
    print(f"📸 Last Snapshot: {status['last_snapshot']}")
    print(f"🚦 Health: {status['health']}")

    if issues:
        print("\n⚠️  Issues:")
        for issue in issues:
            print(f"   {issue}")

    # Save status to file
    status_file = os.path.join(NAVI_DIR, 'system_status.json')
    try:
        with open(status_file, 'w') as f:
            json.dump(status, f, indent=2)
        print(f"\n✅ Status saved to: {status_file}")
    except Exception as e:
        print(f"❌ Error saving status: {e}")

    # Output JSON for API consumption
    print("\n" + "="*50)
    print("📄 JSON OUTPUT:")
    print("="*50)
    print(json.dumps(status, indent=2))

if __name__ == "__main__":
    main()