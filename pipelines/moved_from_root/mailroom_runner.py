# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
VBoarder Mail Room Runner (moved from root)
Processes NAVI snapshots and executes file movements
"""

import os
import json
import shutil
from pathlib import Path
from datetime import datetime

# Configuration
NAVI_DIR = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
SNAPSHOT_DIR = os.path.join(NAVI_DIR, "snapshots", "inbox")
INBOX_DIR = os.path.join(NAVI_DIR, "inbox")
ACTIVE_DIR = os.path.join(NAVI_DIR, "ACTIVE")
WAITING_DIR = os.path.join(NAVI_DIR, "WAITING")
DONE_DIR = os.path.join(NAVI_DIR, "DONE")
ARCHIVE_DIR = r"D:\05_AGENTS-AI\06_ARCHIVE"
REFERENCE_DIR = r"D:\05_AGENTS-AI\02_REFERENCE"

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

# The rest of the implementation is unchanged and preserved in git history
