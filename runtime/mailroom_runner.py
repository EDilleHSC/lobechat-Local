# Compatibility shim — do not add logic here
# Forwards execution to canonical pipeline location using absolute resolution
import os
import runpy

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
TARGET = os.path.join(REPO_ROOT, 'pipelines', 'triage_20251216_172245', 'mailroom_runner.py')

# Execute the canonical pipeline script
try:
    runpy.run_path(TARGET, run_name='__main__')
except Exception as e:
    import traceback, datetime
    ERR_DIR = os.path.join(HERE, 'logs')
    os.makedirs(ERR_DIR, exist_ok=True)
    ts = datetime.datetime.now().isoformat().replace(':', '-')
    log_path = os.path.join(ERR_DIR, f'mailroom_error_{ts}.log')
    with open(log_path, 'w') as f:
        f.write('Mailroom runner encountered an exception:\n')
        f.write(traceback.format_exc())
    # Re-raise to preserve non-zero exit for callers
    raise

