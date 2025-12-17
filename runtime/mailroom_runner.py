# Compatibility shim — do not add logic here
# Forwards execution to canonical pipeline location

import runpy

runpy.run_path(
    r"pipelines\triage_20251216_172245\mailroom_runner.py",
    run_name="__main__"
)
