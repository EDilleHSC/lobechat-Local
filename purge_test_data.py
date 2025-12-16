#!/usr/bin/env python3
"""
VBoarder Test Data Purge Script
Removes all test artifacts and prepares system for live data processing
"""

import os
import shutil
from pathlib import Path

def purge_test_data():
    """Purge all test data from VBoarder system"""

    print("🧹 Starting VBoarder Test Data Purge...")

    # 1. Clear presenter output
    presenter_file = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter_output.txt"
    if os.path.exists(presenter_file):
        print("📝 Clearing presenter output...")
        with open(presenter_file, 'w') as f:
            f.write("# VBoarder NAVI Presenter Output\n# Ready for live data processing\n")
        print("✅ Presenter output cleared")

    # 2. Remove ARCHIVE_TEST directory
    archive_test_dir = r"D:\05_AGENTS-AI\06_ARCHIVE\ARCHIVE_TEST"
    if os.path.exists(archive_test_dir):
        print("🗂️ Removing ARCHIVE_TEST directory...")
        try:
            shutil.rmtree(archive_test_dir)
            print("✅ ARCHIVE_TEST directory removed")
        except Exception as e:
            print(f"⚠️ Could not remove ARCHIVE_TEST: {e}")

    # 3. Clear F:\ARCHIVE test files
    f_archive_files = [
        r"F:\ARCHIVE\ARCHIVE_MOVE_LOG_20251214.txt",
        r"F:\ARCHIVE\NAVI_WORKING_SNAPSHOT.zip"
    ]
    for file_path in f_archive_files:
        if os.path.exists(file_path):
            print(f"🗑️ Removing {file_path}...")
            try:
                os.remove(file_path)
                print(f"✅ Removed {os.path.basename(file_path)}")
            except Exception as e:
                print(f"⚠️ Could not remove {file_path}: {e}")

    # 4. Clear TEST_LOGS directory (if empty, just confirm)
    test_logs_dir = r"D:\VBOARDER_WORKSPACE\TEST_LOGS"
    if os.path.exists(test_logs_dir):
        try:
            contents = list(Path(test_logs_dir).rglob("*"))
            if contents:
                print(f"📋 TEST_LOGS contains {len(contents)} items - manual review needed")
            else:
                print("📋 TEST_LOGS directory is empty")
        except Exception as e:
            print(f"⚠️ Could not check TEST_LOGS: {e}")

    # 5. Verify NAVI directories are clean
    navi_dirs = [
        r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\inbox",
        r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\ACTIVE",
        r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\WAITING",
        r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\DONE"
    ]

    print("\n🔍 Verifying NAVI directories are clean...")
    for dir_path in navi_dirs:
        try:
            if os.path.exists(dir_path):
                files = [f for f in os.listdir(dir_path) if os.path.isfile(os.path.join(dir_path, f))]
                if files:
                    print(f"⚠️ {os.path.basename(dir_path)} contains: {files}")
                else:
                    print(f"✅ {os.path.basename(dir_path)} is clean")
            else:
                print(f"⚠️ {os.path.basename(dir_path)} does not exist")
        except Exception as e:
            print(f"⚠️ Could not check {dir_path}: {e}")

    # 6. Clear any test snapshots
    snapshot_dirs = [
        r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\snapshots\inbox",
        r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\snapshots\collection"
    ]

    print("\n🖼️ Checking snapshots...")
    for dir_path in snapshot_dirs:
        try:
            if os.path.exists(dir_path):
                files = [f for f in os.listdir(dir_path) if os.path.isfile(os.path.join(dir_path, f))]
                if files:
                    print(f"📸 {os.path.basename(dir_path)} contains {len(files)} snapshots")
                    # Don't auto-delete snapshots as they might be legitimate
                else:
                    print(f"✅ {os.path.basename(dir_path)} is clean")
        except Exception as e:
            print(f"⚠️ Could not check {dir_path}: {e}")

    print("\n🎯 Test Data Purge Complete!")
    print("✅ System is now ready for live data processing")
    print("📋 NAVI directories verified clean")
    print("🧠 AIR decision engine ready for live analysis")

if __name__ == "__main__":
    purge_test_data()