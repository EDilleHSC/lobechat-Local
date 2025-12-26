import os
import shutil
import tempfile
import json
from pathlib import Path

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import mailroom_runner as mr


def test_package_delivery(tmp_path):
    root = tmp_path
    # create NAVI/packages/CFO_BATCH-0001_20251225 with a file
    packages = root / 'NAVI' / 'packages'
    (packages / 'CFO_BATCH-0001_20251225').mkdir(parents=True)
    pkg_dir = packages / 'CFO_BATCH-0001_20251225'
    file_path = pkg_dir / 'bill_test.pdf'
    file_path.write_text('dummy')

    # create office inbox
    office_inbox = root / 'NAVI' / 'offices' / 'CFO' / 'inbox'
    office_inbox.mkdir(parents=True)

    # monkeypatch ROOT in mailroom_runner
    mr.ROOT = str(root)

    delivered = mr.process_packages()
    assert 'CFO_BATCH-0001_20251225' in delivered
    dest = office_inbox / 'CFO_BATCH-0001_20251225' / 'bill_test.pdf'
    assert dest.exists()


def test_filename_override_routing(tmp_path):
    root = tmp_path
    # create a processed folder and a file that matches the filename override prefix
    processed = root / 'NAVI' / 'processed' / '2025-12-25'
    processed.mkdir(parents=True)
    file_path = processed / 'Navi_Test_Doc.txt'
    file_path.write_text('test')

    # create a minimal routing config with filename_overrides
    config_dir = root / 'NAVI' / 'config'
    config_dir.mkdir(parents=True)
    cfg = {
        'filename_overrides': {
            'Navi_': 'CTO'
        },
        'function_to_office': {
            'Tech': 'CTO'
        }
    }
    (config_dir / 'routing_config.json').write_text(json.dumps(cfg))

    # create office inbox
    office_inbox = root / 'NAVI' / 'offices' / 'CTO' / 'inbox'
    office_inbox.mkdir(parents=True)

    # monkeypatch ROOT in mailroom_runner
    mr.ROOT = str(root)

    routed, routing_details = mr.process_files()

    assert 'Navi_Test_Doc.txt' in routed
    assert 'CTO' in routing_details
    assert (office_inbox / 'Navi_Test_Doc.txt').exists()


if __name__ == '__main__':
    test_package_delivery(Path(tempfile.mkdtemp()))
    test_filename_override_routing(Path(tempfile.mkdtemp()))
    print('ok')
