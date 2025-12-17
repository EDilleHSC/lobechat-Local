import importlib.util
import sys
from pathlib import Path

import pytest


def _load_mailroom_module():
    module_path = Path(__file__).resolve().parents[1] / 'pipelines' / 'triage_20251216_172245' / 'mailroom_runner.py'
    spec = importlib.util.spec_from_file_location('vboarder_mailroom', str(module_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_ensure_destination_is_directory_file(tmp_path):
    module = _load_mailroom_module()

    # Create a file where a directory is expected
    conflict = tmp_path / 'conflict_path'
    conflict.write_text('I am a file, not a directory')

    with pytest.raises(SystemExit) as excinfo:
        module.ensure_destination_is_directory(conflict)

    assert excinfo.value.code == 2


def test_ensure_destination_is_directory_ok(tmp_path):
    module = _load_mailroom_module()

    # Non-existent path => OK
    good = tmp_path / 'not_exists'
    # Should not raise
    module.ensure_destination_is_directory(good)

    # Existing directory => OK
    good.mkdir()
    module.ensure_destination_is_directory(good)
