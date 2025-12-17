import importlib.util
import sys
from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'pipelines' / 'triage_20251216_172245' / 'mailroom_runner.py'
print('Running mailroom from', p)
spec = importlib.util.spec_from_file_location('vboarder_mailroom', str(p))
module = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(module)
except SystemExit as e:
    print('SYSTEMEXIT CODE:', e.code)
    sys.exit(e.code)
except Exception as e:
    import traceback
    print('EXCEPTION DURING RUN:')
    traceback.print_exc()
    sys.exit(3)
else:
    print('mailroom run completed without SystemExit')
