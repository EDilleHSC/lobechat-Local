import json
import os
from datetime import datetime

BASE = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
SNAP_DIR = os.path.join(BASE, "snapshots", "collection")
OUT_HTML = os.path.join(BASE, "COLLECTION", "collection_status.html")

snapshots = sorted(
    [f for f in os.listdir(SNAP_DIR) if f.endswith(".json")],
    reverse=True
)

rows = []

for snap in snapshots:
    path = os.path.join(SNAP_DIR, snap)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows.append(f"""
    <tr>
      <td>{data.get("batch_id","")}</td>
      <td>{data.get("status","unreviewed")}</td>
      <td>{data.get("file_count",0)}</td>
      <td>{data.get("total_size_mb",0)}</td>
      <td>{", ".join(data.get("air_notes", []))}</td>
      <td>{data.get("created_at","")}</td>
    </tr>
    """)

html = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>VBoarder – COLLECTION Overview</title>
<style>
body {{ font-family: Segoe UI, sans-serif; padding: 20px; background: #111; color: #eee; }}
h1 {{ color: #7dd3fc; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{ border: 1px solid #333; padding: 8px; }}
th {{ background: #222; }}
tr:nth-child(even) {{ background: #1a1a1a; }}
.banner {{ background: #2a4a3a; border: 1px solid #4a6a5a; padding: 10px; margin: 10px 0; border-radius: 5px; }}
</style>
</head>
<body>
<h1>📦 COLLECTION Overview</h1>
<p>Generated: {datetime.now().isoformat()}</p>

<div class="banner">
<strong>🛡️ COLLECTION is a bulk intake buffer.</strong><br>
Nothing here affects daily operations until you manually move it to Inbox.
</div>

<table>
<tr>
  <th>Batch ID</th>
  <th>Status</th>
  <th>Files</th>
  <th>Size (MB)</th>
  <th>AIR Notes</th>
  <th>Created</th>
</tr>
{''.join(rows)}
</table>

<p style="margin-top:20px; color:#888;">
COLLECTION is advisory only. No files are moved from here automatically.
</p>
</body>
</html>
"""

with open(OUT_HTML, "w", encoding="utf-8") as f:
    f.write(html)

print("COLLECTION status page updated.")