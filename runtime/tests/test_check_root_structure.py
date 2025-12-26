import os
import subprocess
import sys
from pathlib import Path

def run(cmd, cwd=None):
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return res.returncode, res.stdout + res.stderr


def make_readme(tmpdir, names):
    # create a minimal README_COMPLIANCE.md snippet with approved root structure
    content = """# D: DRIVE COMPLIANCE & OPERATIONAL RULES

## APPROVED ROOT STRUCTURE (ONLY THESE)

D:
"""
    for n in names:
        content += f"{n}\n"
    content += "\n---\n"
    (tmpdir / 'README_COMPLIANCE.md').write_text(content, encoding='utf-8')
    return tmpdir / 'README_COMPLIANCE.md'


def test_no_unexpected(tmp_path):
    # Setup a fake root directory with only allowed entries
    root = tmp_path / 'drive'
    root.mkdir()
    allowed = ['01_SYSTEM_Core', '02_SOFTWARE', '03_DATA-Storage', 'README_COMPLIANCE.md']
    for a in allowed:
        (root / a).mkdir() if '.' not in a else (root / a).write_text('')
    readme = make_readme(tmp_path, allowed)

    script = Path(__file__).parents[2] / 'tools' / 'check_root_structure.py'
    rc, out = run([sys.executable, str(script), '--root', str(root), '--compliance', str(readme)])
    assert rc == 0, f"Expected 0, got {rc}. Output:\n{out}"
    assert 'OK: no unexpected items' in out


def test_unexpected_detected(tmp_path):
    root = tmp_path / 'drive'
    root.mkdir()
    allowed = ['01_SYSTEM_Core', '02_SOFTWARE']
    for a in allowed:
        (root / a).mkdir()
    # add an unexpected item
    (root / 'BAD_STUFF').mkdir()
    readme = make_readme(tmp_path, allowed)

    script = Path(__file__).parents[2] / 'tools' / 'check_root_structure.py'
    rc, out = run([sys.executable, str(script), '--root', str(root), '--compliance', str(readme)])
    assert rc == 1
    assert 'Unexpected items' in out
    assert 'BAD_STUFF' in out
