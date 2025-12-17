# ROOT_EXCEPTION_OK
(moved to pipelines/moved_from_root — see git history)
# Processor configuration and dry-run support
PROCESSOR_CONFIG_FILE = os.path.join(NAVI_DIR, 'processor_config.json')

def load_processor_config():
    cfg = {'dry_run': True}
    try:
        if os.path.exists(PROCESSOR_CONFIG_FILE):
            with open(PROCESSOR_CONFIG_FILE, 'r') as f:
                user_cfg = json.load(f)
            cfg.update(user_cfg)
    except Exception as e:
        print(f"Warning: could not load processor config: {e}")
    return cfg

PROCESSOR_CONFIG = load_processor_config()

# Non-actionable file types and their archive destinations
NON_ACTIONABLE = {
    '.log': 'LOGS',
    '.err': 'LOGS',
    '.out': 'LOGS',
    '.tmp': 'RUNTIME_EXHAUST',
    '.cache': 'RUNTIME_EXHAUST',
    '.lock': 'RUNTIME_EXHAUST',
    '.pid': 'RUNTIME_EXHAUST',
    '.bak': 'BACKUPS',
    '.old': 'BACKUPS',
    '.swp': 'BACKUPS',
    '.ds_store': 'BACKUPS',
    '.thumbs.db': 'BACKUPS',
    '.meta': 'METADATA',
    '.jsonl': 'METADATA',
    '.trace': 'METADATA',
    '.zip': 'PACKAGES',
    '.rar': 'PACKAGES',
    '.7z': 'PACKAGES',
    '.tar': 'PACKAGES',
    '.gz': 'PACKAGES',
}

# Allowed actionable file extensions for inbox
ALLOWED_EXTENSIONS = [
    '.docx', '.pdf', '.xlsx', '.pptx', '.txt', '.rtf', '.doc', '.xls', '.ppt'
]

def get_latest_snapshot():
    """Get the most recent snapshot from the inbox snapshots directory"""
    if not os.path.exists(SNAPSHOT_DIR):
        print(f"ERROR: Snapshot directory not found: {SNAPSHOT_DIR}")
        return None

    snapshot_files = [f for f in os.listdir(SNAPSHOT_DIR) if f.endswith('.json')]
    if not snapshot_files:
        print("No snapshots found")
        return None

    # Sort by timestamp (filenames contain timestamps)
    snapshot_files.sort(reverse=True)
    latest_file = snapshot_files[0]
    snapshot_path = os.path.join(SNAPSHOT_DIR, latest_file)

    try:
        with open(snapshot_path, 'r') as f:
            snapshot = json.load(f)
        print(f"Loaded latest snapshot: {latest_file}")
        return snapshot
    except Exception as e:
        print(f"ERROR: Error loading snapshot {latest_file}: {e}")
        return None

def execute_moves(snapshot):
    """Execute file movements based on snapshot data"""
    if not snapshot or snapshot.get('status') != 'unprocessed':
        print("WARNING: No unprocessed snapshot to execute")
        return

    items = snapshot.get('items', [])
    moved_count = 0
    archived_count = 0
    rejected_count = 0

    for item in items:
        filename = item['name']
        source_path = os.path.join(INBOX_DIR, filename)

        if not os.path.exists(source_path):
            print(f"WARNING: File not found in inbox: {filename}")
            continue

        # Check if file is non-actionable
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        if ext in NON_ACTIONABLE:
            # Non-actionable: archive immediately
            subfolder = NON_ACTIONABLE[ext]
            dest_dir = os.path.join(ARCHIVE_DIR, subfolder)
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, filename)

            try:
                if PROCESSOR_CONFIG.get('dry_run', True):
                    print(f"[DRY-RUN] Would archive non-actionable {filename} to {subfolder}")
                else:
                    shutil.move(source_path, dest_path)
                    print(f"Archived non-actionable {filename} to {subfolder}")
                    archived_count += 1
            except Exception as e:
                print(f"ERROR: Error archiving {filename}: {e}")
        elif ext not in ALLOWED_EXTENSIONS:
            # Not allowed: reject to REFERENCE
            dest_dir = REFERENCE_DIR
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, filename)

            try:
                if PROCESSOR_CONFIG.get('dry_run', True):
                    print(f"[DRY-RUN] Would reject non-work item {filename} to REFERENCE")
                else:
                    shutil.move(source_path, dest_path)
                    print(f"Rejected non-work item {filename} to REFERENCE")
                    rejected_count += 1
            except Exception as e:
                print(f"ERROR: Error rejecting {filename}: {e}")
        else:
            # Actionable: move to ACTIVE
            dest_dir = ACTIVE_DIR
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, filename)

            try:
                if PROCESSOR_CONFIG.get('dry_run', True):
                    print(f"[DRY-RUN] Would move {filename} to {os.path.basename(dest_dir)}")
                else:
                    shutil.move(source_path, dest_path)
                    print(f"Moved {filename} to {os.path.basename(dest_dir)}")
                    moved_count += 1
            except Exception as e:
                print(f"ERROR: Error moving {filename}: {e}")

    # Mark snapshot as processed
    snapshot['status'] = 'processed'
    snapshot['processed_at'] = datetime.now().isoformat()

    # Save updated snapshot
    snapshot_filename = f"{snapshot['timestamp'].replace(':', '-').replace('.', '-')}.json"
    snapshot_path = os.path.join(SNAPSHOT_DIR, snapshot_filename)
    try:
        with open(snapshot_path, 'w') as f:
            json.dump(snapshot, f, indent=2)
        print(f"Updated snapshot status to processed")
    except Exception as e:
        print(f"ERROR: Error updating snapshot: {e}")

    print(f"Processed {moved_count} actionable files, archived {archived_count} non-actionable files, rejected {rejected_count} non-work items")

def main():
    print("VBoarder Mail Room Runner Starting...")
    print(f"Inbox: {INBOX_DIR}")
    print(f"Snapshots: {SNAPSHOT_DIR}")
    print(f"Active: {ACTIVE_DIR}")

    # Get latest snapshot
    snapshot = get_latest_snapshot()
    if snapshot:
        # Execute moves
        execute_moves(snapshot)
    else:
        print("No work to do")

    print("Mail room processing complete")

if __name__ == "__main__":
    main()