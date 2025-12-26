#!/usr/bin/env python3
"""Check the root structure against README_COMPLIANCE.md approved list.

Usage:
  python tools/check_root_structure.py --root D:\ --compliance README_COMPLIANCE.md

The script parses the "APPROVED ROOT STRUCTURE" section of the README and
reports any top-level files or directories at --root that are not listed.
Exit code 0 = OK (no unexpected items), 1 = unexpected items found.
"""
import argparse
import os
import re
import sys


def parse_allowed_from_readme(readme_path):
    text = open(readme_path, 'r', encoding='utf-8').read()
    # Try to find the "APPROVED ROOT STRUCTURE (ONLY THESE)" block
    m = re.search(r'APPROVED ROOT STRUCTURE \(ONLY THESE\)(.*?)(?:\n---|\Z)', text, re.S)
    block = m.group(1) if m else ''

    names = set()
    # Look for lines like '├── 01_SYSTEM_Core' or '└── README_COMPLIANCE.md'
    for line in block.splitlines():
        line = line.strip()
        m2 = re.match(r'[├└│\-\s]*[├└]?──\s*(\S+)', line)
        if m2:
            names.add(m2.group(1))
        else:
            # fallback: plain list lines (e.g., '01_SYSTEM_Core')
            if re.match(r'^[0-9A-Za-z_\-]{2,}$', line):
                names.add(line)
    # Always allow README_COMPLIANCE.md as a root file
    names.add('README_COMPLIANCE.md')
    return sorted(names)


def find_unexpected(root, allowed):
    try:
        entries = sorted(os.listdir(root))
    except Exception as e:
        print(f"ERROR: cannot list root '{root}': {e}")
        sys.exit(2)
    unexpected = [e for e in entries if e not in allowed]
    return unexpected


def main():
    p = argparse.ArgumentParser(description='Check root structure against README compliance list')
    p.add_argument('--root', default='D:\\', help='Root path to check (default D:\\)')
    p.add_argument('--compliance', default=os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'README_COMPLIANCE.md'), help='Path to compliance README')
    p.add_argument('--allow', action='append', default=[], help='Extra allowed names (repeatable)')
    p.add_argument('--verbose', action='store_true')
    p.add_argument('--fail-on-violation', action='store_true', help='Exit non-zero if violations found')
    args = p.parse_args()

    if not os.path.exists(args.compliance):
        print(f"Compliance file not found: {args.compliance}")
        sys.exit(2)

    allowed = set(parse_allowed_from_readme(args.compliance))
    for a in args.allow:
        allowed.add(a)

    # Informational
    if args.verbose:
        print(f"Allowed (parsed {len(allowed)}): {sorted(allowed)}")

    unexpected = find_unexpected(args.root, allowed)

    if not unexpected:
        print(f"OK: no unexpected items found at {args.root}")
        sys.exit(0)

    print(f"Unexpected items found at {args.root}:")
    for u in unexpected:
        print(f"  - {u}")

    if args.fail_on_violation:
        sys.exit(1)
    else:
        # Non-zero but not fatal unless flag used; still return 1 so CI can opt-in
        sys.exit(1)


if __name__ == '__main__':
    main()
