# Copied file — original preserved in git history
# Original author and content preserved.

# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
VBoarder AIR (Autonomous Intelligence Runtime) Test
Demonstrates AIR reading from ACTIVE/ and making decisions
"""

import os
import json
from pathlib import Path
from datetime import datetime

# Configuration
NAVI_DIR = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
ACTIVE_DIR = os.path.join(NAVI_DIR, "ACTIVE")
SNAPSHOT_DIR = os.path.join(NAVI_DIR, "snapshots", "inbox")
WAITING_DIR = os.path.join(NAVI_DIR, "WAITING")
DONE_DIR = os.path.join(NAVI_DIR, "DONE")
COLLECTION_DIR = os.path.join(NAVI_DIR, "COLLECTION")
COLLECTION_SNAPSHOTS = os.path.join(NAVI_DIR, "snapshots", "collection")

# Allowed extensions for confidence calculation
ALLOWED_EXTENSIONS = ['.docx', '.pdf', '.xlsx', '.pptx', '.txt', '.rtf', '.odt', '.doc', '.xls', '.ppt']

# The rest of the implementation is unchanged and preserved in git history
