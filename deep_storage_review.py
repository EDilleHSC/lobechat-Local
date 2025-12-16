#!/usr/bin/env python3
"""
VBoarder Deep Storage Review Scanner
Advisory-only inventory and risk assessment for deep storage locations
"""

import os
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter
import mimetypes

# Configuration
SCAN_LOCATIONS = [
    r"F:\ARCHIVE",
    r"D:\05_AGENTS-AI\06_ARCHIVE"
]

REPORT_FILE = r"D:\VBOARDER_WORKSPACE\REPORTS\DEEP_STORAGE_REVIEW_20251215.md"

def get_file_info(filepath):
    """Get file metadata"""
    stat = os.stat(filepath)
    return {
        'size': stat.st_size,
        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
        'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
    }

def scan_directory(root_path):
    """Scan a directory and return inventory data"""
    inventory = {
        'folders': [],
        'files': [],
        'file_types': Counter(),
        'size_distribution': defaultdict(int),
        'date_ranges': {'oldest': None, 'newest': None},
        'total_size': 0,
        'total_files': 0,
        'total_folders': 0
    }

    try:
        for root, dirs, files in os.walk(root_path):
            # Track folders
            for dir_name in dirs:
                inventory['folders'].append(os.path.join(root, dir_name))
                inventory['total_folders'] += 1

            # Track files
            for file_name in files:
                filepath = os.path.join(root, file_name)
                try:
                    info = get_file_info(filepath)

                    # File type
                    _, ext = os.path.splitext(file_name.lower())
                    if ext:
                        inventory['file_types'][ext] += 1
                    else:
                        inventory['file_types']['no_extension'] += 1

                    # Size distribution
                    size_mb = info['size'] / (1024 * 1024)
                    if size_mb < 1:
                        inventory['size_distribution']['< 1MB'] += 1
                    elif size_mb < 10:
                        inventory['size_distribution']['1-10MB'] += 1
                    elif size_mb < 100:
                        inventory['size_distribution']['10-100MB'] += 1
                    else:
                        inventory['size_distribution']['> 100MB'] += 1

                    # Date ranges
                    mod_date = datetime.fromisoformat(info['modified'])
                    if inventory['date_ranges']['oldest'] is None or mod_date < inventory['date_ranges']['oldest']:
                        inventory['date_ranges']['oldest'] = mod_date
                    if inventory['date_ranges']['newest'] is None or mod_date > inventory['date_ranges']['newest']:
                        inventory['date_ranges']['newest'] = mod_date

                    inventory['files'].append({
                        'path': filepath,
                        'name': file_name,
                        'info': info
                    })

                    inventory['total_size'] += info['size']
                    inventory['total_files'] += 1

                except (OSError, ValueError) as e:
                    print(f"Error processing {filepath}: {e}")
                    continue

    except (OSError, PermissionError) as e:
        print(f"Error scanning {root_path}: {e}")
        return None

    return inventory

def analyze_patterns(inventory):
    """Analyze for patterns and potential issues"""
    patterns = {
        'large_folders': [],
        'duplicate_patterns': [],
        'mixed_content': [],
        'unknown_formats': [],
        'potential_collections': []
    }

    # Large folders (folders with many files)
    folder_counts = defaultdict(int)
    for file_info in inventory['files']:
        folder = os.path.dirname(file_info['path'])
        folder_counts[folder] += 1

    for folder, count in folder_counts.items():
        if count > 100:  # Arbitrary threshold
            patterns['large_folders'].append(f"{folder}: {count} files")

    # Duplicate patterns (similar names)
    names = [f['name'] for f in inventory['files']]
    name_patterns = Counter()
    for name in names:
        # Simple pattern: remove numbers and dates
        pattern = ''.join(c for c in name if not c.isdigit() and c not in '._-')
        if len(pattern) > 10:  # Avoid too generic
            name_patterns[pattern.lower()] += 1

    for pattern, count in name_patterns.items():
        if count > 5:  # Multiple similar files
            patterns['duplicate_patterns'].append(f"Pattern '{pattern}': {count} similar files")

    # Unknown formats
    known_extensions = {'.pdf', '.doc', '.docx', '.txt', '.jpg', '.png', '.zip', '.rar', '.7z', '.json', '.xml', '.html', '.csv'}
    for ext, count in inventory['file_types'].items():
        if ext not in known_extensions and count > 10:
            patterns['unknown_formats'].append(f"{ext}: {count} files")

    # Potential collections (archives that look like inputs)
    for file_info in inventory['files']:
        name = file_info['name'].lower()
        if any(keyword in name for keyword in ['batch', 'import', 'input', 'raw', 'source']):
            patterns['potential_collections'].append(file_info['path'])

    return patterns

def generate_report(scan_results):
    """Generate the advisory report"""
    report = f"""# Deep Storage Review – Advisory Report

Date: {datetime.now().strftime('%Y-%m-%d')}
Scope:
"""

    for location in SCAN_LOCATIONS:
        report += f"- {location}\n"

    report += "\n## Executive Summary\n"

    total_files = sum(r['total_files'] for r in scan_results.values() if r)
    total_size_gb = sum(r['total_size'] for r in scan_results.values() if r) / (1024**3)
    total_folders = sum(r['total_folders'] for r in scan_results.values() if r)

    report += f"Scanned {len(scan_results)} locations containing approximately {total_files:,} files "
    report += f"({total_size_gb:.1f} GB) across {total_folders:,} folders. "
    report += "This is a read-only advisory scan - no files were moved or modified.\n"

    report += "\n## What Exists\n"

    for location, inventory in scan_results.items():
        if not inventory:
            report += f"\n### {location}\n- **ACCESS DENIED** - Could not scan this location\n"
            continue

        report += f"\n### {location}\n"
        report += f"- **Files**: {inventory['total_files']:,}\n"
        report += f"- **Folders**: {inventory['total_folders']:,}\n"
        report += f"- **Total Size**: {inventory['total_size'] / (1024**3):.1f} GB\n"

        if inventory['date_ranges']['oldest'] and inventory['date_ranges']['newest']:
            oldest = inventory['date_ranges']['oldest'].strftime('%Y-%m-%d')
            newest = inventory['date_ranges']['newest'].strftime('%Y-%m-%d')
            report += f"- **Date Range**: {oldest} to {newest}\n"

        # Top file types
        if inventory['file_types']:
            top_types = inventory['file_types'].most_common(5)
            report += f"- **Top File Types**: {', '.join(f'{ext} ({count})' for ext, count in top_types)}\n"

    report += "\n## Potential Future Candidates (NOT ACTIONS)\n"

    all_patterns = {}
    for location, inventory in scan_results.items():
        if inventory:
            all_patterns[location] = analyze_patterns(inventory)

    for location, patterns in all_patterns.items():
        report += f"\n### {location}\n"

        if patterns['large_folders']:
            report += "- **Large Folders**: May need manual review\n"
            for folder in patterns['large_folders'][:5]:  # Limit to 5
                report += f"  - {folder}\n"

        if patterns['duplicate_patterns']:
            report += "- **Potential Duplicates**: Similar naming patterns detected\n"
            for pattern in patterns['duplicate_patterns'][:3]:
                report += f"  - {pattern}\n"

        if patterns['potential_collections']:
            report += f"- **{len(patterns['potential_collections'])} items** that might be suitable for COLLECTION later\n"

    report += "\n## Risks & Warnings\n"

    for location, patterns in all_patterns.items():
        report += f"\n### {location}\n"

        if patterns['unknown_formats']:
            report += "- **Unknown Formats**: May contain unexpected content\n"
            for fmt in patterns['unknown_formats']:
                report += f"  - {fmt}\n"

        # Check for mixed content folders
        folder_types = defaultdict(set)
        for file_info in scan_results[location]['files']:
            folder = os.path.dirname(file_info['path'])
            _, ext = os.path.splitext(file_info['name'])
            folder_types[folder].add(ext.lower())

        mixed_folders = [f for f, types in folder_types.items() if len(types) > 3]
        if mixed_folders:
            report += f"- **Mixed Content**: {len(mixed_folders)} folders contain diverse file types (may be complex to process)\n"

    report += "\n## What Was NOT Done\n"
    report += "- No files moved\n"
    report += "- No files processed\n"
    report += "- No COLLECTION changes\n"
    report += "- No automated decisions made\n"
    report += "- This was purely an observational scan\n"

    return report

def main():
    print("🧠 Starting Deep Storage Review Scan...")
    print("This is a read-only advisory scan - no files will be modified.")

    scan_results = {}
    for location in SCAN_LOCATIONS:
        print(f"📁 Scanning {location}...")
        try:
            result = scan_directory(location)
            scan_results[location] = result
            if result:
                print(f"   Found {result['total_files']:,} files, {result['total_folders']:,} folders")
            else:
                print("   Access denied or error")
        except Exception as e:
            print(f"   Error: {e}")
            scan_results[location] = None

    print("📊 Generating report...")
    report = generate_report(scan_results)

    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"✅ Report saved to: {REPORT_FILE}")
    print("📋 Review complete - check the report for findings.")

if __name__ == "__main__":
    main()