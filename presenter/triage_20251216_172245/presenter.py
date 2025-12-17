# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
VBoarder NAVI Presenter Model
Converts AIR's structured JSON output into user-friendly UI text
"""

import json
import os
from pathlib import Path
from datetime import datetime

# Configuration
NAVI_DIR = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
AIR_OUTPUT_FILE = os.path.join(NAVI_DIR, 'air_output.json')

def load_air_output():
    """Load the latest AIR output"""
    if not os.path.exists(AIR_OUTPUT_FILE):
        return None

    try:
        with open(AIR_OUTPUT_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading AIR output: {e}")
        return None

def format_priority_emoji(priority):
    """Get emoji for priority level"""
    if priority == 'URGENT':
        return '[URGENT]'
    elif priority == 'HIGH':
        return '[HIGH]'
    elif priority == 'MEDIUM':
        return '[MEDIUM]'
    else:
        return '[LOW]'

def format_destination_emoji(destination):
    """Get emoji for destination"""
    if destination == 'ACTIVE':
        return '-> ACTIVE'
    elif destination == 'WAITING':
        return '-> WAITING'
    elif destination == 'DONE':
        return '-> DONE'
    else:
        return '-> UNKNOWN'

def generate_presenter_output(air_data):
    """Convert AIR JSON to user-friendly text"""
    if not air_data:
        return "No recent activity to display"

    lines = []

    # Header
    lines.append("NAVI Mail Room Update")
    lines.append(f"{air_data['summary']}")
    lines.append("")

    # Process each item
    for item in air_data['items']:
        emoji = format_priority_emoji(item['priority'])
        dest_emoji = format_destination_emoji(item['destination'])

        lines.append(f"{emoji} {item['file']}")
        lines.append(f"{dest_emoji}")
        lines.append(f"Reason: {item['reason']}")
        if 'confidence' in item:
            lines.append(f"Confidence: {item['confidence']}% ({item['confidence_label']})")
        lines.append("")

    # Next steps
    if air_data.get('next_steps'):
        lines.append("Next Steps")
        for step in air_data['next_steps']:
            lines.append(f"• {step}")
        lines.append("")

    # Timestamp
    if air_data.get('timestamp'):
        dt = datetime.fromisoformat(air_data['timestamp'])
        lines.append(f"Processed at {dt.strftime('%H:%M:%S')}")

    return "\n".join(lines)

def generate_presenter_html(air_data):
    """Convert AIR JSON to HTML for presenter/index.html"""
    if not air_data:
        return ""

    head_html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NAVI Mail Room Update</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #0a0e27;
            color: #f0f0f0;
            font-family: 'Atkinson Hyperlegible', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 32px 24px;
            line-height: 1.8;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        /* HEADER */
        .header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 40px;
            padding-bottom: 24px;
            border-bottom: 3px solid #1e2749;
        }

        .header-icon {
            font-size: 36px;
        }

        .header-content h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 6px;
            letter-spacing: 0.3px;
        }

        .header-content p {
            font-size: 16px;
            color: #a0a8c0;
        }

        /* SUMMARY CARD */
        .summary-card {
            background: #0f1433;
            border-left: 5px solid #4a90e2;
            padding: 24px;
            margin-bottom: 32px;
            border-radius: 8px;
        }

        .summary-card h2 {
            font-size: 20px;
            margin-bottom: 12px;
            color: #e8e8ff;
        }

        .summary-card p {
            font-size: 18px;
            color: #c8d0e0;
            margin-bottom: 8px;
        }

        /* TWO-COLUMN LAYOUT */
        .main-grid {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 32px;
            margin-bottom: 40px;
        }

        /* LEFT: ACTION BUTTONS */
        .actions-column {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .action-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 24px 20px;
            border: 3px solid;
            border-radius: 12px;
            background: #0f1433;
            cursor: pointer;
            font-family: 'Atkinson Hyperlegible', sans-serif;
            font-size: 18px;
            font-weight: 700;
            transition: all 0.2s ease;
            text-align: center;
        }

        .action-btn:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
        }

        .action-btn-track {
            border-color: #22c55e;
            color: #22c55e;
        }

        .action-btn-track:hover {
            background: rgba(34, 197, 94, 0.1);
        }

        .action-btn-escalate {
            border-color: #ef4444;
            color: #ef4444;
        }

        .action-btn-escalate:hover {
            background: rgba(239, 68, 68, 0.1);
        }

        .action-btn-hold {
            border-color: #eab308;
            color: #eab308;
        }

        .action-btn-hold:hover {
            background: rgba(234, 179, 8, 0.1);
        }

        .action-icon {
            font-size: 48px;
        }

        .action-title {
            font-size: 18px;
            font-weight: 700;
        }

        .action-desc {
            font-size: 14px;
            opacity: 0.85;
            font-weight: 400;
        }

        /* RIGHT: FILE INFO */
        .info-column {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .file-card {
            background: #0f1433;
            border-left: 5px solid #eab308;
            padding: 28px;
            border-radius: 12px;
        }

        .file-card h3 {
            font-size: 22px;
            margin-bottom: 20px;
            color: #e8e8ff;
        }

        .file-meta {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .meta-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 12px;
            border-bottom: 1px solid #1e2749;
        }

        .meta-label {
            font-size: 16px;
            color: #a0a8c0;
            font-weight: 600;
        }

        .meta-value {
            font-size: 18px;
            color: #e8e8ff;
            font-weight: 600;
        }

        .confidence-badge {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 700;
        }

        /* REASONING SECTION */
        .reasoning {
            background: #0f1433;
            border-left: 5px solid #4a90e2;
            padding: 28px;
            border-radius: 12px;
            margin-bottom: 32px;
        }

        .reasoning h4 {
            font-size: 20px;
            margin-bottom: 20px;
            color: #e8e8ff;
        }

        .reason-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .reason-item {
            font-size: 16px;
            color: #c8d0e0;
            padding-left: 28px;
            position: relative;
        }

        .reason-item:before {
            content: "•";
            position: absolute;
            left: 0;
            color: #4a90e2;
            font-weight: 700;
            font-size: 20px;
        }

        .reason-item strong {
            color: #e8e8ff;
            font-weight: 700;
        }

        /* FOOTER */
        .footer {
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #0f1433;
            padding: 24px;
            border-radius: 12px;
            font-size: 16px;
            color: #c8d0e0;
        }

        .footer-item {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .footer-item:before {
            content: "✓";
            color: #22c55e;
            font-weight: 700;
            font-size: 18px;
        }

        @media (max-width: 768px) {
            .main-grid {
                grid-template-columns: 1fr;
                gap: 24px;
            }

            .actions-column {
                flex-direction: row;
            }

            .action-btn {
                flex: 1;
            }

            .action-icon {
                font-size: 36px;
            }

            .action-title {
                font-size: 16px;
            }

            .action-desc {
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        .summary-card {
            background: #0f1433;
            border-left: 5px solid #4a90e2;
            padding: 24px;
            margin-bottom: 32px;
            border-radius: 8px;
        }

        .summary-card h2 {
            font-size: 20px;
            margin-bottom: 12px;
            color: #e8e8ff;
        }

        .summary-card p {
            font-size: 18px;
            color: #c8d0e0;
            margin-bottom: 8px;
        }

        /* TWO-COLUMN LAYOUT */
        .main-grid {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 32px;
            margin-bottom: 40px;
        }

        /* LEFT: ACTION BUTTONS */
        .actions-column {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .action-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 24px 20px;
            border: 3px solid;
            border-radius: 12px;
            background: #0f1433;
            cursor: pointer;
            font-family: 'Atkinson Hyperlegible', sans-serif;
            font-size: 18px;
            font-weight: 700;
            transition: all 0.2s ease;
            text-align: center;
        }

        .action-btn:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
        }

        .action-btn-track {
            border-color: #22c55e;
            color: #22c55e;
        }

        .action-btn-track:hover {
            background: rgba(34, 197, 94, 0.1);
        }

        .action-btn-escalate {
            border-color: #ef4444;
            color: #ef4444;
        }

        .action-btn-escalate:hover {
            background: rgba(239, 68, 68, 0.1);
        }

        .action-btn-hold {
            border-color: #eab308;
            color: #eab308;
        }

        .action-btn-hold:hover {
            background: rgba(234, 179, 8, 0.1);
        }

        .action-icon {
            font-size: 48px;
        }

        .action-title {
            font-size: 18px;
            font-weight: 700;
        }

        .action-desc {
            font-size: 14px;
            opacity: 0.85;
            font-weight: 400;
        }

        /* RIGHT: FILE INFO */
        .info-column {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .file-card {
            background: #0f1433;
            border-left: 5px solid #eab308;
            padding: 28px;
            border-radius: 12px;
        }

        .file-card h3 {
            font-size: 22px;
            margin-bottom: 20px;
            color: #e8e8ff;
        }

        .file-meta {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .meta-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 12px;
            border-bottom: 1px solid #1e2749;
        }

        .meta-label {
            font-size: 16px;
            color: #a0a8c0;
            font-weight: 600;
        }

        .meta-value {
            font-size: 18px;
            color: #e8e8ff;
            font-weight: 600;
        }

        .confidence-badge {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 700;
        }

        /* REASONING SECTION */
        .reasoning {
            background: #0f1433;
            border-left: 5px solid #4a90e2;
            padding: 28px;
            border-radius: 12px;
            margin-bottom: 32px;
        }

        .reasoning h4 {
            font-size: 20px;
            margin-bottom: 20px;
            color: #e8e8ff;
        }

        .reason-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .reason-item {
            font-size: 16px;
            color: #c8d0e0;
            padding-left: 28px;
            position: relative;
        }

        .reason-item:before {
            content: "•";
            position: absolute;
            left: 0;
            color: #4a90e2;
            font-weight: 700;
            font-size: 20px;
        }

        .reason-item strong {
            color: #e8e8ff;
            font-weight: 700;
        }

        /* FOOTER */
        .footer {
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #0f1433;
            padding: 24px;
            border-radius: 12px;
            font-size: 16px;
            color: #c8d0e0;
        }

        .footer-item {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .footer-item:before {
            content: "✓";
            color: #22c55e;
            font-weight: 700;
            font-size: 18px;
        }

        @media (max-width: 768px) {
            .main-grid {
                grid-template-columns: 1fr;
                gap: 24px;
            }

            .actions-column {
                flex-direction: row;
            }

            .action-btn {
                flex: 1;
            }

            .action-icon {
                font-size: 36px;
            }

            .action-title {
                font-size: 16px;
            }

            .action-desc {
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">"""

    # Timestamp
    if air_data.get('timestamp'):
        dt = datetime.fromisoformat(air_data['timestamp'])
        timestamp_str = dt.strftime('%H:%M:%S')
    else:
        timestamp_str = 'recently'

    # Summary
    item_count = len(air_data.get('items', []))
    header_html = f"""
        <!-- HEADER -->
        <div class="header">
            <div class="header-icon">📬</div>
            <div class="header-content">
                <h1>NAVI Mail Room Update</h1>
                <p>Processed at {timestamp_str}</p>
            </div>
        </div>"""

    # Build left action blocks for items
    actions_blocks = ""
    for item in air_data['items']:
        actions_blocks += f"""
            <!-- LEFT: ACTION BUTTONS -->
            <div class="actions-column">
                <button class="action-btn action-btn-track">
                    <div class="action-icon">🟢</div>
                    <div class="action-title">Track</div>
                    <div class="action-desc">Accept responsibility</div>
                </button>

                <button class="action-btn action-btn-hold">
                    <div class="action-icon">🟡</div>
                    <div class="action-title">Hold</div>
                    <div class="action-desc">Not actionable now</div>
                </button>

                <button class="action-btn action-btn-escalate">
                    <div class="action-icon">🔴</div>
                    <div class="action-title">Escalate</div>
                    <div class="action-desc">Deadlines · Delegation · Fire drills</div>
                </button>
            </div>
        """

    # Build right info blocks for items
    info_blocks = ""
    for item in air_data['items']:
        filename = item['file']
        _, ext = os.path.splitext(filename)
        ext = ext[1:].upper()

        info_blocks += f"""
                <div class="file-card">
                    <h3>📄 {filename}</h3>
                    <div class="file-meta">
                        <div class="meta-item">
                            <span class="meta-label">Routed to:</span>
                            <span class="meta-value">{item['destination']}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Confidence:</span>
                            <span class="confidence-badge">{item['confidence']}% ({item['confidence_label']})</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">File type:</span>
                            <span class="meta-value">{ext}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Received:</span>
                            <span class="meta-value">{air_data['timestamp'][:10]}</span>
                        </div>
                    </div>
                </div>
        """


    rest_html = """
        <!-- REASONING -->
        <div class="reasoning">
            <h4>Why did NAVI think this?</h4>
            <ul class="reason-list">
                <li class="reason-item">Matched priority keywords: <strong>important, urgent, priority</strong></li>
                <li class="reason-item">File type allowed for work intake</li>
                <li class="reason-item">No exclusion rules triggered</li>
                <li class="reason-item">No conflicting signals detected</li>
            </ul>
        </div>
    """

    # Footer moved into template placeholder to avoid duplication
    footer_html = """
        <div class="footer">
            <div class="footer-item">✓ Presenter is advisory only</div>
            <div class="footer-item">✓ No files moved or modified</div>
            <div class="footer-item">✓ Human decisions applied separately</div>
            <div class="footer-item">✓ Inbox accepts work items only</div>
            <div class="footer-item">✓ Review opens file location only</div>
        </div>
    """

    # Build a summary + content-grid that matches the template_final layout
    items_html = f"""
        <!-- SUMMARY -->
        <div class="summary-card">
            <h2>Summary</h2>
            <p>{item_count} incoming request{"s" if item_count != 1 else ""} processed</p>
            <p>Items routed to ACTIVE, WAITING, or DONE</p>
        </div>

        <!-- MAIN CONTENT -->
        <div class="content-grid">
            <!-- LEFT: ACTIONS (vertical stack) -->
            <div class="actions-section">
                <button class="action-btn btn-track">
                    <div class="action-icon">🟢</div>
                    <div class="action-text">
                        <div class="action-title">Track</div>
                        <div class="action-desc">Accept responsibility</div>
                    </div>
                </button>

                <button class="action-btn btn-hold">
                    <div class="action-icon">🟡</div>
                    <div class="action-text">
                        <div class="action-title">Hold</div>
                        <div class="action-desc">Not actionable now</div>
                    </div>
                </button>

                <button class="action-btn btn-escalate">
                    <div class="action-icon">🔴</div>
                    <div class="action-text">
                        <div class="action-title">Escalate</div>
                        <div class="action-desc">Deadlines · Delegation · Fire drills</div>
                    </div>
                </button>
            </div>

            <!-- RIGHT: FILES -->
            <div class="files-section">
                {info_blocks}
            </div>
        </div>
    """

    # Attempt to use external template if present, otherwise fall back to inline assembly
    template_path = Path(NAVI_DIR) / 'presenter' / 'template.html'
    final_html = None
    try:
        if template_path.exists():
            tpl = template_path.read_text()
            try:
                # Sanitize template by escaping all braces and restoring only known placeholders
                safe_tpl = tpl.replace('{', '{{').replace('}', '}}')
                # Restore expected placeholders (including optional designer slots)
                for key in ('head','header','items','rest','timestamp','title','subtitle','footer','nav'):
                    safe_tpl = safe_tpl.replace('{{' + key + '}}', '{' + key + '}')
                final_html = safe_tpl.format(
                    head='',  # don't inject full document head; template provides its own
                    header=header_html,
                    items=items_html,
                    rest=rest_html,
                    timestamp=timestamp_str,
                    title='NAVI Presenter',
                    subtitle='Operational Overview',
                    footer=footer_html,
                    nav=''
                )
                print('[Using external template]')
            except Exception as e:
                print(f'[Template format failed, falling back] {e}')
                final_html = head_html + header_html + items_html + rest_html
        else:
            print('[Fallback to inline HTML]')
            final_html = head_html + header_html + items_html + rest_html
    except Exception as e:
        print(f'[Template error, fallback] {e}')
        final_html = head_html + header_html + items_html + rest_html

    # Final cleanup: fix any stray double braces left from template escaping which break CSS
    if isinstance(final_html, str) and ('{{' in final_html or '}}' in final_html):
        final_html = final_html.replace('{{', '{').replace('}}', '}')
        print('[Template cleanup applied: fixed stray double-braces]')

    return final_html

def main():
    """Main presenter function"""
    print("VBoarder NAVI Presenter Starting...")

    # Load AIR output
    air_data = load_air_output()

    if not air_data:
        print("ERROR: No AIR output found")
        return

    print("Loaded AIR data from:", AIR_OUTPUT_FILE)

    # Generate presenter output
    presenter_text = generate_presenter_output(air_data)

    # Save presenter output
    presenter_file = os.path.join(NAVI_DIR, 'presenter_output.txt')
    try:
        with open(presenter_file, 'w', encoding='utf-8') as f:
            f.write(presenter_text)
        print(f"Presenter output saved to: {presenter_file}")
    except Exception as e:
        print(f"ERROR: Error saving presenter output: {e}")
        return

    # Generate and save HTML
    presenter_html = generate_presenter_html(air_data)
    html_file = os.path.join(NAVI_DIR, 'presenter', 'index.html')
    try:
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(presenter_html)
        print(f"Presenter HTML saved to: {html_file}")
    except Exception as e:
        print(f"ERROR: Error saving presenter HTML: {e}")

    # Display the output
    print("\n" + "="*50)
    print("PRESENTER OUTPUT:")
    print("="*50)
    print(presenter_text)
    print("="*50)

if __name__ == "__main__":
    main()