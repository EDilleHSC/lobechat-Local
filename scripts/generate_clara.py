#!/usr/bin/env python3
"""Generate a static Clara HTML page from NAVI/air_output.json

Writes to NAVI/presenter/clara.html
"""
import json
import os
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
NAVI = os.path.join(REPO, 'NAVI')
AIR_FILE = os.path.join(NAVI, 'air_output.json')
OUT_FILE = os.path.join(NAVI, 'presenter', 'clara.html')

# Load data
try:
    with open(AIR_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception as e:
    data = {
        'agent': 'AIR',
        'action': 'route',
        'summary': 'No data available',
        'items': [],
        'timestamp': datetime.now().isoformat()
    }

# Helper to safely render lists
def render_signals(signals):
    if not signals:
        return ''
    return '<ul>' + ''.join(f'<li>{s}</li>' for s in signals) + '</ul>'

# Generate items html
items_html = ''
for it in data.get('items', []):
    file = it.get('file', 'Unknown')
    priority = it.get('priority', '')
    dest = it.get('destination', '')
    reason = it.get('reason', '')
    conf = it.get('confidence', '')
    signals = it.get('signals', [])

    items_html += f"""
    <div class="file-card">
      <h3>📄 {file}</h3>
      <div class="file-meta">
        <div class="meta-item"><span class="meta-label">Destination:</span><span class="meta-value">{dest}</span></div>
        <div class="meta-item"><span class="meta-label">Priority:</span><span class="meta-value">{priority}</span></div>
        <div class="meta-item"><span class="meta-label">Confidence:</span><span class="meta-value">{conf}%</span></div>
        <div class="meta-item"><span class="meta-label">Reason:</span><span class="meta-value">{reason}</span></div>
        <div class="meta-item"><span class="meta-label">Signals:</span><span class="meta-value">{render_signals(signals)}</span></div>
      </div>
      <div class="actions-section">
        <button class="action-btn btn-track">🟢 Accept (Track)</button>
        <button class="action-btn btn-hold">🟡 Hold</button>
        <button class="action-btn btn-escalate">🔴 Escalate</button>
      </div>
    </div>
    """

# Build final HTML
html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Clara — NAVI Presenter</title>
  <style>
    body{{background:#0a0e27;color:#f0f0f0;font-family:Segoe UI,Arial,sans-serif;padding:24px}}
    .container{{max-width:1000px;margin:0 auto}}
    .header{{display:flex;align-items:center;gap:12px;margin-bottom:20px}}
    .summary-card{{background:#0f1433;border-left:5px solid #4a90e2;padding:16px;border-radius:6px;margin-bottom:18px}}
    .file-card{{background:#0f1433;border-left:5px solid #f5a623;padding:18px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;gap:18px}}
    .file-meta{{flex:1}}
    .meta-item{{margin-bottom:8px}}
    .meta-label{{color:#a0a8c0;min-width:110px;display:inline-block}}
    .meta-value{{color:#f0f0f0}}
    .actions-section{{display:flex;flex-direction:column;gap:8px}}
    .action-btn{{padding:8px 12px;border-radius:6px;border:0;cursor:pointer}}
    .btn-track{{background:#163b13;color:#bff0b3}}
    .btn-hold{{background:#3b2a00;color:#ffd88a}}
    .btn-escalate{{background:#4a0a0a;color:#ffb3b3}}
    small.timestamp{{color:#9aa2b6}}
    ul{{margin:6px 0 0 18px}}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Clara — NAVI Presenter</h1>
      <small class="timestamp">Last update: {data.get('timestamp','')}</small>
    </div>
    <div class="summary-card">
      <strong>{data.get('summary','')}</strong>
    </div>

    {items_html}

    <footer style="margin-top:20px;color:#9aa2b6">Clara (clarification layer) — read-only view. Use this to review and decide.</footer>
  </div>
</body>
</html>
"""

# Write output
os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Wrote {OUT_FILE}")
