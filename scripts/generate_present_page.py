#!/usr/bin/env python3
"""Generate a simple NAVI present page (NAVI/present/index.html)

Reads NAVI/offices/*/inbox and NAVI/packages/* manifests to build a clean
HTML status page with Office cards, package lists and per-package file lists.
"""
import json
import os
from datetime import datetime, timezone

# Determine repo root from this script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
NAVI_ROOT = os.path.join(REPO_ROOT, 'NAVI')
OFFICES_DIR = os.path.join(NAVI_ROOT, 'offices')
PACKAGES_DIR = os.path.join(NAVI_ROOT, 'packages')
PRESENT_DIR = os.path.join(NAVI_ROOT, 'present')

os.makedirs(PRESENT_DIR, exist_ok=True)


def load_package_manifest(pkg_name):
    path = os.path.join(PACKAGES_DIR, pkg_name, 'manifest.json')
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None
    return None


def list_office_inbox(office):
    inbox = os.path.join(OFFICES_DIR, office, 'inbox')
    if not os.path.exists(inbox):
        return {'packages': [], 'files': []}
    entries = os.listdir(inbox)
    packages = []
    files = []
    for name in sorted(entries):
        p = os.path.join(inbox, name)
        if os.path.isdir(p):
            packages.append(name)
        else:
            files.append(name)
    return {'packages': packages, 'files': files}


def build_snapshot():
    offices = {}
    if not os.path.exists(OFFICES_DIR):
        return offices
    for office in sorted(os.listdir(OFFICES_DIR)):
        office_path = os.path.join(OFFICES_DIR, office)
        if not os.path.isdir(office_path):
            continue
        data = list_office_inbox(office)
        # enrich package contents
        pkg_items = []
        for pkg in data['packages']:
            manifest = load_package_manifest(pkg)
            if manifest and manifest.get('files'):
                files = [f['filename'] for f in manifest.get('files', [])]
            else:
                # fallback: list files under inbox/<pkg>
                pdir = os.path.join(OFFICES_DIR, office, 'inbox', pkg)
                files = []
                if os.path.exists(pdir):
                    for root, _, fnames in os.walk(pdir):
                        for fn in fnames:
                            files.append(os.path.relpath(os.path.join(root, fn), pdir))
            pkg_items.append({'name': pkg, 'files': files})
        offices[office] = {'packages': pkg_items, 'files': data['files']}
    return offices


def render_html(snapshot):
    updated = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    total_packages = sum(len(v['packages']) for v in snapshot.values())
    total_files = sum(len(v['files']) for v in snapshot.values()) + sum(len(p['files']) for v in snapshot.values() for p in v['packages'])

    html_parts = []
    html_parts.append('<!doctype html>')
    html_parts.append('<html lang="en">')
    html_parts.append('<head>')
    html_parts.append('<meta charset="utf-8">')
    html_parts.append('<meta name="viewport" content="width=device-width, initial-scale=1">')
    html_parts.append('<title>NAVI — Present</title>')
    html_parts.append('<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px} .header{display:flex;justify-content:space-between;align-items:center} .grid{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px} .card{border:1px solid #ddd;border-radius:6px;padding:12px;width:260px;background:#fff;box-shadow: 0 1px 2px rgba(0,0,0,0.03)} .card h3{margin:0 0 8px 0} .small{color:#666;font-size:0.9em} .pkg{margin-top:8px;padding-top:6px;border-top:1px dashed #eee} .pkg b{display:block}</style>')
    html_parts.append('</head>')
    html_parts.append('<body>')
    html_parts.append(f'<div class="header"><h1>NAVI — Batch Overview</h1><div class="small">Last updated: {updated}<br/>Packages: {total_packages} · Files: {total_files}</div></div>')

    html_parts.append('<div class="grid">')
    for office, data in sorted(snapshot.items()):
        pkg_count = len(data['packages'])
        file_count = len(data['files']) + sum(len(p['files']) for p in data['packages'])
        html_parts.append('<div class="card">')
        html_parts.append(f'<h3>{office}</h3>')
        html_parts.append(f'<div class="small">Packages: {pkg_count} · Files: {file_count}</div>')
        if pkg_count > 0:
            html_parts.append('<div class="pkg">')
            for p in data['packages']:
                html_parts.append(f'<div><b>{p["name"]}</b>')
                html_parts.append('<ul>')
                for fn in p['files']:
                    html_parts.append(f'<li>{fn}</li>')
                html_parts.append('</ul></div>')
            html_parts.append('</div>')
        if data['files']:
            html_parts.append('<div class="pkg"><b>Inbox files</b><ul>')
            for fn in data['files']:
                html_parts.append(f'<li>{fn}</li>')
            html_parts.append('</ul></div>')
        html_parts.append('</div>')
    html_parts.append('</div>')

    # review section
    html_parts.append('<hr/><h2>Reviewer notes</h2>')
    html_parts.append('<p class="small">Add notes, routing decisions, or actions for the next batch here.</p>')
    html_parts.append('<p><em>Auto-generated. Use NAVI reports for detailed logs.</em></p>')
    html_parts.append('</body></html>')
    return '\n'.join(html_parts)


if __name__ == '__main__':
    snapshot = build_snapshot()
    html = render_html(snapshot)
    out_path = os.path.join(PRESENT_DIR, 'index.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)
    json_path = os.path.join(PRESENT_DIR, 'present.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(snapshot, f, indent=2)
    print(out_path)
