Files moved from project root to align with `VBOARDER STRUCTURE v1` on 2025-12-16:

- mailroom_runner.py → pipelines/moved_from_root/mailroom_runner.py
- collection_status.py → pipelines/moved_from_root/collection_status.py
- purge_test_data.py → pipelines/moved_from_root/purge_test_data.py
- status_server.py → pipelines/moved_from_root/status_server.py
- status_monitor.py → pipelines/moved_from_root/status_monitor.py
- tool_loop_guard.py → pipelines/moved_from_root/tool_loop_guard.py

Notes:
- Root now contains only thin shims (e.g., `Process_Inbox.bat`, `start_mcp_server.bat`) and documentation.
- No deletion or refactor of code was performed; full file contents are preserved in git history and `pipelines/moved_from_root/`.
- This is a pure relocation action to enforce the project structure lock.

Root Guard: A CI guard has been added (`.github/workflows/root-guard.yml`) that runs `scripts/check_root_guard.py` to prevent adding processing code or servers to project root. To intentionally allow an exception, add the comment `# ROOT_EXCEPTION_OK` to the file needing the exception.
