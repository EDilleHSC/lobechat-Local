# Canonical shim for mailroom_runner — forwards to existing implementation if present
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
CAND1 = os.path.join(REPO_ROOT, 'pipelines', 'triage_20251216_172245', 'mailroom_runner.py')
CAND2 = os.path.join(REPO_ROOT, 'scripts', 'mailroom_runner_copy.py')

if os.path.exists(CAND1):
    target = CAND1
elif os.path.exists(CAND2):
    target = CAND2
else:
    print('ERROR: canonical mailroom runner not found. Expected at:')
    print('  ', CAND1)
    print('or')
    print('  ', CAND2)
    sys.exit(1)

# Execute the canonical pipeline script
try:
    runpy.run_path(target, run_name='__main__')
except SystemExit:
    raise
except Exception:
    import traceback
    traceback.print_exc()
    sys.exit(1)
