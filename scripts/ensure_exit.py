import sys
from pathlib import Path
import logging

def ensure_destination_is_directory(dest_path: Path):
    if dest_path.exists() and dest_path.is_file():
        msg = f"MAILROOM_INVARIANT: Destination path exists but is a FILE.\nPath: {dest_path}"
        logging.error(msg)
        print(msg, file=sys.stderr)
        sys.exit(2)

if __name__ == '__main__':
    p = Path(r'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\REFERENCE')
    ensure_destination_is_directory(p)
    print('no exit')
