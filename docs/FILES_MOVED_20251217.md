Files moved on 2025-12-17 as part of Beta-0 structure lock (core/ layout):

- `pipelines/triage_20251216_172245/` → `core/intake/pipelines/triage_20251216_172245/`
- `pipelines/moved_from_root/` → `core/intake/pipelines/moved_from_root/`
- `presenter/triage_20251216_172245/` → `core/presenter/presenter/triage_20251216_172245/`
- `mcp_server.py` → `core/runtime/mcp_server.py` (root replaced with shim to run new location)
- `status_server.py`, `status_monitor.py`, `deep_storage_review.py` → `core/runtime/` (roots replaced with shims)
- `start_mcp_server.bat`, `start_servers.bat` → `core/runtime/` (root shims forward to new location)

Notes:
- No behavior changes were made beyond creating thin shims that forward to the canonical locations.
- All originals are preserved in commit history and placeholder files remain in their original folders pointing to the new locations.
- This is a safe, reversible move to enforce the locked structure for Beta-0.
