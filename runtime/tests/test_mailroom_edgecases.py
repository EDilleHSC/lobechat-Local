import os
import json
from pathlib import Path
import tempfile

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import mailroom_runner as mr


def test_missing_sidecar_defaults_to_exec(tmp_path):
    root = tmp_path
    processed = root / 'NAVI' / 'processed' / '2025-12-25'
    processed.mkdir(parents=True)
    (processed / 'no_sidecar.txt').write_text('data')

    # Ensure config does not override
    mr.ROOT = str(root)
    routed, details = mr.process_files()
    assert 'no_sidecar.txt' in routed
    assert 'EXEC' in details


def test_duplicate_package_names_de_duplicated(tmp_path):
    root = tmp_path
    packages = root / 'NAVI' / 'packages'
    packages.mkdir(parents=True)
    (packages / 'CFO_BATCH-0001_20251225').mkdir()
    (packages / 'CFO_BATCH-0001_20251225' / 'a.txt').write_text('a')

    # simulate already delivered by creating destination
    office_inbox = root / 'NAVI' / 'offices' / 'CFO' / 'inbox' / 'CFO_BATCH-0001_20251225'
    office_inbox.mkdir(parents=True)

    mr.ROOT = str(root)
    delivered = mr.process_packages()
    # Should return the package name but not error
    assert 'CFO_BATCH-0001_20251225' in delivered


if __name__ == '__main__':
    test_missing_sidecar_defaults_to_exec(Path(tempfile.mkdtemp()))
    test_duplicate_package_names_de-duplicated(Path(tempfile.mkdtemp()))
    print('ok')