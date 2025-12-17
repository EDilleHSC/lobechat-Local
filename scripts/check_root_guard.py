#!/usr/bin/env python3
"""Check repo root for disallowed processing files.

Rules (enforced):
 - Files in repo root matching patterns: '*_server.*', '*_runner.*', 'process_*'
 - Any top-level .py or .js files not explicitly whitelisted

Override: if a file contains the text '# ROOT_EXCEPTION_OK' it will be allowed.
"""
from pathlib import Path
import re
import sys

ROOT = Path('.').resolve()
ALLOWED_NAMES = {
    'README.md', 'README_COMPLIANCE.md', 'STRUCTURE.md', 'VBOARDER_CANON.md',
    'Process_Inbox.bat', 'start_mcp_server.bat', 'start_servers.bat',
    'mcp_server.js', '.gitignore', '.gitattributes'
}
ALLOWED_DIRS = {'docs', 'runtime', 'pipelines', 'presenter', 'NAVI', 'ops', 'configs', 'tests', 'node_modules', '.github', 'core'}

PATTERNS = [re.compile(r'.*_server\..*', re.I),
            re.compile(r'.*_runner\..*', re.I),
            re.compile(r'process_.*', re.I)]

violations = []

for p in ROOT.iterdir():
    # only consider top-level files and visible items
    name = p.name
    if name in ALLOWED_NAMES or name in ALLOWED_DIRS:
        continue

    # Ignore hidden files starting with . except .github handled above
    if name.startswith('.'):
        continue

    # If item is a directory and not allowed -> ignore (we only guard files)
    if p.is_dir():
        continue

    # Allow explicit exceptions via magic comment
    try:
        text = p.read_text(encoding='utf-8')
    except Exception:
        text = ''

    if '# ROOT_EXCEPTION_OK' in text:
        continue

    # Pattern matches
    for pat in PATTERNS:
        if pat.match(name):
            violations.append((name, f"Matches pattern {pat.pattern}"))
            break

    # Disallow top-level .py or .js files (unless whitelisted)
    if p.suffix in {'.py', '.js'} and name not in ALLOWED_NAMES:
        violations.append((name, f"Top-level {p.suffix} file not allowed"))

if violations:
    print('\n[ROOT GUARD] Detected disallowed files in project root:')
    for v, reason in violations:
        print(f' - {v}: {reason}')
    print('\nIf this is intentional, add a comment "# ROOT_EXCEPTION_OK" to the file to allow it.')
    sys.exit(2)
else:
    print('[ROOT GUARD] No violations found. Root looks clean.')
    sys.exit(0)
