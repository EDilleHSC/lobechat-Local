#!/usr/bin/env python3
"""NAVI Mailroom Runner v2.0

Routes files to 9 offices ONLY:
  CFO, CLO, COO, CSO, CMO, CTO, AIR, EXEC, COS

Default route: EXEC (Clara handles unclear items)
No legacy code. No agent1. No ghosts.
"""
import json
import os
import shutil
from datetime import datetime, timezone

# === CONFIGURATION ===
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Allow overriding NAVI_ROOT via environment (used by tests/CI)
NAVI_ROOT = os.environ.get('NAVI_ROOT') or os.path.join(ROOT, 'NAVI')
CONFIG_PATH = os.path.join(NAVI_ROOT, 'config', 'routing_config.json')
PROCESSED_DIR = os.path.join(NAVI_ROOT, 'processed')
OFFICES_DIR = os.path.join(NAVI_ROOT, 'offices')
PACKAGES_DIR = os.path.join(NAVI_ROOT, 'packages')

# The ONLY valid offices - nothing else exists
VALID_OFFICES = ['CFO', 'CLO', 'COO', 'CSO', 'CMO', 'CTO', 'AIR', 'EXEC', 'COS']
DEFAULT_OFFICE = 'EXEC'  # Clara handles unclear items


def load_config():
    """Load routing config (computed from ROOT at runtime)."""
    navi_root = os.path.join(ROOT, 'NAVI')
    cfg_path = os.path.join(navi_root, 'config', 'routing_config.json')
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def get_office_from_route(route, config):
    """
    Map a route/function to a valid office.
    Returns office name or DEFAULT_OFFICE.
    """
    if not route:
        return DEFAULT_OFFICE
    
    # Normalize: if dotted like 'LHI.Finance', take last segment
    if '.' in route:
        route = route.split('.')[-1]
    
    # Direct match to valid office
    if route.upper() in VALID_OFFICES:
        return route.upper()
    if route in VALID_OFFICES:
        return route
    
    # Map function to office via config
    function_to_office = config.get('function_to_office', {})
    mapped = function_to_office.get(route)
    if mapped and mapped in VALID_OFFICES:
        return mapped
    
    # Default
    return DEFAULT_OFFICE


def check_filename_override(filename, config):
    """
    Check if filename matches an override pattern.
    Returns office name or None.
    """
    overrides = config.get('filename_overrides', {})
    for prefix, office in overrides.items():
        if filename and filename.startswith(prefix):
            if office in VALID_OFFICES:
                return office
    return None


def deliver_to_office(src_path, sidecar_path, office):
    """
    Copy file and sidecar to office inbox.
    Returns True on success.
    """
    if office not in VALID_OFFICES:
        office = DEFAULT_OFFICE
    
    inbox = os.path.join(NAVI_ROOT, 'offices', office, 'inbox')
    os.makedirs(inbox, exist_ok=True)
    
    filename = os.path.basename(src_path)
    dst = os.path.join(inbox, filename)
    
    try:
        shutil.copy2(src_path, dst)
        if sidecar_path and os.path.exists(sidecar_path):
            shutil.copy2(sidecar_path, dst + '.navi.json')
        return True
    except Exception as e:
        print(f"Error delivering {filename} to {office}: {e}", file=__import__('sys').stderr)
        return False


def process_files():
    """
    Process all files in NAVI/processed subdirectories.
    Routes each to the correct office based on sidecar or filename override.
    """
    config = load_config()
    routed = []
    routing_details = {}  # office -> [files]
    
    processed_dir = PROCESSED_DIR
    offices_dir = os.path.join(NAVI_ROOT, 'offices')

    if not os.path.exists(processed_dir):
        return routed, routing_details
    
    # Walk processed subdirs (newest first)
    subdirs = sorted(
        [d for d in os.listdir(processed_dir) if os.path.isdir(os.path.join(processed_dir, d))],
        reverse=True
    )
    
    for subdir in subdirs:
        subdir_path = os.path.join(processed_dir, subdir)
        
        for fname in os.listdir(subdir_path):
            # Skip sidecars, process base files only
            if fname.endswith('.navi.json') or fname.endswith('.meta.json'):
                continue
            
            src = os.path.join(subdir_path, fname)
            if not os.path.isfile(src):
                continue
            
            sidecar = src + '.navi.json'
            
            # 1. Check filename override FIRST
            office = check_filename_override(fname, config)
            
            # 2. If no override, check sidecar
            if not office and os.path.exists(sidecar):
                try:
                    with open(sidecar, 'r', encoding='utf-8') as f:
                        sc = json.load(f)
                        route = sc.get('route') or sc.get('function')
                        office = get_office_from_route(route, config)
                except Exception:
                    office = DEFAULT_OFFICE
            
            # 3. Default to EXEC
            if not office:
                office = DEFAULT_OFFICE
            
            # Deliver
            if deliver_to_office(src, sidecar, office):
                routed.append(fname)
                if office not in routing_details:
                    routing_details[office] = []
                routing_details[office].append(fname)
    
    return routed, routing_details


def process_packages():
    """
    Deliver packages from NAVI/packages to office inboxes.
    Package naming: OFFICE_BATCH-XXXX_YYYYMMDD
    """
    packages_dir = PACKAGES_DIR
    if not os.path.exists(packages_dir):
        return []
    
    delivered = []
    
    for name in os.listdir(packages_dir):
        pkg_path = os.path.join(packages_dir, name)
        if not os.path.isdir(pkg_path):
            continue
        
        # Parse office from package name
        if '_BATCH-' not in name:
            continue
        
        office = name.split('_BATCH-')[0]
        if office not in VALID_OFFICES:
            continue
        
        inbox = os.path.join(ROOT, 'NAVI', 'offices', office, 'inbox')
        os.makedirs(inbox, exist_ok=True)
        
        dest = os.path.join(inbox, name)
        if os.path.exists(dest):
            # Already delivered
            delivered.append(name)
            continue
        
        try:
            shutil.copytree(pkg_path, dest)
            delivered.append(name)
        except Exception:
            continue
    
    return delivered


def main():
    """Main entry point."""
    # Process packages first
    packages = process_packages()
    
    # Process individual files
    routed, routing_details = process_files()
    
    # Output summary
    output = {
        'status': 'success',
        'routed_files': routed,
        'packages_delivered': packages,
        'routing_summary': routing_details,
        'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    }
    
    print(json.dumps(output, indent=2))

    # Regenerate present page for humans
    try:
        import subprocess, sys
        py = sys.executable or 'python'
        gen = os.path.join(ROOT, 'scripts', 'generate_present_page.py')
        if os.path.exists(gen):
            # run generator from repo root and capture output
            res = subprocess.run([py, gen], cwd=ROOT, capture_output=True, text=True)
            log_path = os.path.join(NAVI_ROOT, 'logs', 'present_gen.log')
            try:
                os.makedirs(os.path.dirname(log_path), exist_ok=True)
                with open(log_path, 'a', encoding='utf-8') as lf:
                    lf.write(f"[{datetime.now(timezone.utc).isoformat()}] generator returncode={res.returncode}\n")
                    lf.write(res.stdout or '')
                    lf.write(res.stderr or '')
            except Exception:
                pass
            if res.returncode != 0:
                # surface failure to stderr so CI can detect failures
                print(f"Present page generator failed with returncode={res.returncode}", file=__import__('sys').stderr)
    except Exception:
        pass


if __name__ == '__main__':
    main()
