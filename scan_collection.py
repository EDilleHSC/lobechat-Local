#!/usr/bin/env python3
"""
VBoarder COLLECTION Scanner
Bulk intake system for NAVI - creates batches from INCOMING
"""

import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from collections import Counter

# Configuration
NAVI_DIR = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
COLLECTION_DIR = os.path.join(NAVI_DIR, "COLLECTION")
INCOMING_DIR = os.path.join(COLLECTION_DIR, "INCOMING")
BATCHES_DIR = os.path.join(COLLECTION_DIR, "BATCHES")
SNAPSHOT_DIR = os.path.join(NAVI_DIR, "snapshots", "collection")
BATCH_LOG = os.path.join(COLLECTION_DIR, "logs", "batch_log.json")
REVIEW_LOG = os.path.join(COLLECTION_DIR, "logs", "review_log.json")

def get_file_extension(filepath):
    """Get file extension in lowercase"""
    return Path(filepath).suffix.lower().lstrip('.')

def analyze_file_types(file_list):
    """Analyze file types and return counts"""
    extensions = [get_file_extension(f) for f in file_list]
    file_types = Counter(extensions)

    # Group unknown extensions
    known_types = ['zip', 'pdf', 'docx', 'exe', 'txt', 'jpg', 'png', 'doc', 'xls', 'xlsx']
    result = {}
    unknown_count = 0

    for ext, count in file_types.items():
        if ext in known_types:
            result[ext] = count
        else:
            unknown_count += count

    if unknown_count > 0:
        result['unknown'] = unknown_count

    return result

def detect_flags(file_list):
    """Detect special conditions"""
    extensions = [get_file_extension(f) for f in file_list]

    return {
        "contains_executables": any(ext in ['exe', 'msi', 'bat', 'cmd'] for ext in extensions),
        "contains_archives": any(ext in ['zip', 'rar', '7z', 'tar', 'gz'] for ext in extensions),
        "possible_duplicates": len(file_list) > len(set(os.path.basename(f) for f in file_list))
    }

def get_total_size_mb(file_list):
    """Calculate total size in MB"""
    total_bytes = sum(os.path.getsize(f) for f in file_list)
    return round(total_bytes / (1024 * 1024), 2)

def generate_batch_id(source="bulk_import"):
    """Generate batch ID with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d")
    # Find next index for this source today
    existing_batches = [d for d in os.listdir(BATCHES_DIR) if d.startswith(f"{timestamp}_{source}")]
    index = len(existing_batches) + 1
    return f"{timestamp}_{source}_{index:03d}"

def run_air_analysis(batch_id, file_list):
    """Run AIR analysis (read-only, advisory only)"""
    # This would call AIR with read-only access to COLLECTION
    # For now, return basic analysis
    air_notes = []

    file_types = analyze_file_types(file_list)
    flags = detect_flags(file_list)

    if flags["contains_executables"]:
        air_notes.append("Contains executable files - review security implications")

    if flags["contains_archives"]:
        air_notes.append("Contains archive files - may need extraction before processing")

    if flags["possible_duplicates"]:
        air_notes.append("Possible duplicate filenames detected")

    total_size = get_total_size_mb(file_list)
    if total_size > 1000:
        air_notes.append(f"Large batch ({total_size}MB) - consider splitting")

    return air_notes

def create_snapshot(batch_id, file_list):
    """Create snapshot JSON with exact schema"""
    file_types = analyze_file_types(file_list)
    flags = detect_flags(file_list)
    air_notes = run_air_analysis(batch_id, file_list)

    snapshot = {
        "batch_id": batch_id,
        "created_at": datetime.now().isoformat() + "Z",
        "source": "COLLECTION",
        "status": "unreviewed",
        "file_count": len(file_list),
        "total_size_mb": get_total_size_mb(file_list),
        "file_types": file_types,
        "flags": flags,
        "air_notes": air_notes,
        "human_decision": None
    }

    # Save snapshot
    snapshot_filename = f"{batch_id}.json"
    snapshot_path = os.path.join(SNAPSHOT_DIR, snapshot_filename)

    with open(snapshot_path, 'w') as f:
        json.dump(snapshot, f, indent=2)

    print(f"Snapshot created: {snapshot_path}")
    return snapshot

def log_batch(batch_id, file_count, total_size_mb):
    """Append to batch log"""
    entry = {
        "batch_id": batch_id,
        "timestamp": datetime.now().isoformat() + "Z",
        "file_count": file_count,
        "total_size_mb": total_size_mb
    }

    # Read existing log or create empty list
    if os.path.exists(BATCH_LOG):
        with open(BATCH_LOG, 'r') as f:
            log_data = json.load(f)
    else:
        log_data = []

    log_data.append(entry)

    with open(BATCH_LOG, 'w') as f:
        json.dump(log_data, f, indent=2)

    print(f"Batch logged: {batch_id}")

def scan_and_batch():
    """Main scanning function"""
    print("VBoarder COLLECTION Scanner Starting...")

    # Verify INCOMING has files
    if not os.path.exists(INCOMING_DIR):
        print("ERROR: INCOMING directory not found")
        return False

    incoming_files = []
    for root, dirs, files in os.walk(INCOMING_DIR):
        for file in files:
            incoming_files.append(os.path.join(root, file))

    if not incoming_files:
        print("No files in INCOMING directory")
        return False

    print(f"Found {len(incoming_files)} files to process")

    # Generate batch ID
    batch_id = generate_batch_id()
    batch_dir = os.path.join(BATCHES_DIR, batch_id)

    # Create batch directory
    os.makedirs(batch_dir, exist_ok=True)

    # Move files from INCOMING to batch
    moved_count = 0
    for src_path in incoming_files:
        # Preserve relative path structure
        rel_path = os.path.relpath(src_path, INCOMING_DIR)
        dest_path = os.path.join(batch_dir, rel_path)

        # Ensure destination directory exists
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        shutil.move(src_path, dest_path)
        moved_count += 1

    print(f"Moved {moved_count} files to batch: {batch_id}")

    # Get final file list from batch
    batch_files = []
    for root, dirs, files in os.walk(batch_dir):
        for file in files:
            batch_files.append(os.path.join(root, file))

    # Create snapshot
    snapshot = create_snapshot(batch_id, batch_files)

    # Log batch
    log_batch(batch_id, len(batch_files), snapshot["total_size_mb"])

    print(f"COLLECTION scan complete: {batch_id}")
    print(f"Files: {len(batch_files)}")
    print(f"Size: {snapshot['total_size_mb']}MB")
    print(f"Location: {batch_dir}")

    return True

if __name__ == "__main__":
    success = scan_and_batch()
    exit(0 if success else 1)