import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_SRC = REPO_ROOT / 'scripts' / 'check_root_guard.py'


def run_check(cwd: Path):
    """Run the guard script in the provided cwd and return CompletedProcess"""
    return subprocess.run([sys.executable, 'scripts/check_root_guard.py'], cwd=str(cwd), capture_output=True, text=True)


def _install_script_to(tmp_path: Path):
    scripts_dir = tmp_path / 'scripts'
    scripts_dir.mkdir()
    dst = scripts_dir / 'check_root_guard.py'
    dst.write_text(SCRIPT_SRC.read_text(encoding='utf-8'))
    return dst


def test_clean_root(tmp_path: Path):
    _install_script_to(tmp_path)
    # allowed top-level README should be fine
    (tmp_path / 'README.md').write_text('ok')

    res = run_check(tmp_path)
    assert res.returncode == 0
    assert 'No violations found' in res.stdout


def test_violation_server_pattern(tmp_path: Path):
    _install_script_to(tmp_path)
    # create a violating file
    (tmp_path / 'bad_server.py').write_text('print("x")')

    res = run_check(tmp_path)
    assert res.returncode != 0
    assert 'bad_server.py' in res.stdout
    assert 'Matches pattern' in res.stdout


def test_magic_comment_allows(tmp_path: Path):
    _install_script_to(tmp_path)
    (tmp_path / 'bad_server.py').write_text('# ROOT_EXCEPTION_OK\nprint("ok")')

    res = run_check(tmp_path)
    assert res.returncode == 0
    assert 'No violations found' in res.stdout


def test_top_level_py_disallowed(tmp_path: Path):
    _install_script_to(tmp_path)
    (tmp_path / 'random.py').write_text('print("hi")')

    res = run_check(tmp_path)
    assert res.returncode != 0
    assert 'random.py' in res.stdout
    assert 'Top-level' in res.stdout
