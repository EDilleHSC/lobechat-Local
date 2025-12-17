# Compatibility shim — do not add logic here
# Forwards execution to canonical pipeline location using absolute resolution
import os
import runpy

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
TARGET = os.path.join(REPO_ROOT, 'pipelines', 'triage_20251216_172245', 'mailroom_runner.py')

# Execute the canonical pipeline script
runpy.run_path(TARGET, run_name='__main__')
