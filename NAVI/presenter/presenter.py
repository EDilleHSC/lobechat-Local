"""
NAVI Presenter - Mail Room Item Display
Generates HTML presentation of mail room items with proper vertical button layout

FIXED: Inline template now uses single braces (not Python escape syntax)
FIXED: Better path handling for template discovery
"""

import os
from pathlib import Path
from datetime import datetime

class Presenter:
    def __init__(self, presenter_dir=None):
        if presenter_dir is None:
            self.presenter_dir = Path(__file__).parent.resolve()
        else:
            self.presenter_dir = Path(presenter_dir).resolve()
        
        self.template_path = self.presenter_dir / "template.html"
        self.output_path = self.presenter_dir / "index.html"
        
        print(f"[Presenter dir: {self.presenter_dir}]")
        print(f"[Template path: {self.template_path}]")
        print(f"[Template exists: {self.template_path.exists()}]")
    
    def generate_header(self, timestamp=None):
        """Generate header HTML"""
        if timestamp is None:
            timestamp = datetime.now().strftime("%H:%M:%S")
        
        return f'''<!-- HEADER -->
        <div class="header">
            <div class="header-icon">📬</div>
            <div class="header-content">
                <h1>NAVI Mail Room Update</h1>
                <p>Processed at {timestamp}</p>
            </div>
        </div>'''
    
    def generate_items(self, items_data):
        """
        Generate items HTML with vertical button layout
        
        items_data should be a dict like:
        {
            'filename': 'Client_Notes_Intro.docx',
            'routed_to': 'ACTIVE',
            'confidence': '90% (High)',
            'file_type': 'DOCX',
            'received': '2025-12-15',
            'keywords': 'important, urgent, priority'
        }
        """
        filename = items_data.get('filename', 'Unknown File')
        routed_to = items_data.get('routed_to', 'UNKNOWN')
        confidence = items_data.get('confidence', '0% (Low)')
        file_type = items_data.get('file_type', 'UNKNOWN')
        received = items_data.get('received', datetime.now().strftime("%Y-%m-%d"))
        keywords = items_data.get('keywords', '')
        
        return f'''<!-- SUMMARY -->
        <div class="summary-card">
            <h2>Summary</h2>
            <p>1 incoming request processed</p>
            <p>Items routed to ACTIVE, WAITING, or DONE</p>
        </div>

        <!-- MAIN CONTENT -->
        <div class="content-grid">
            <!-- LEFT: ACTIONS (VERTICAL BUTTONS) -->
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

            <!-- RIGHT: FILE INFO -->
            <div class="file-card">
                <h3>📄 {filename}</h3>
                <div class="file-meta">
                    <div class="meta-item">
                        <span class="meta-label">Routed to:</span>
                        <span class="meta-value">{routed_to}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Confidence:</span>
                        <span class="confidence-badge">{confidence}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">File type:</span>
                        <span class="meta-value">{file_type}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Received:</span>
                        <span class="meta-value">{received}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- REASONING -->
        <div class="reasoning">
            <h4>Why did NAVI think this?</h4>
            <ul class="reason-list">
                <li class="reason-item">Matched priority keywords: <strong>{keywords}</strong></li>
                <li class="reason-item">File type allowed for work intake</li>
                <li class="reason-item">No exclusion rules triggered</li>
                <li class="reason-item">No conflicting signals detected</li>
            </ul>
        </div>'''
    
    def generate_footer(self):
        """Generate footer HTML"""
        return '''<!-- FOOTER -->
        <div class="footer">
            <div class="footer-item">✓ Presenter is advisory only</div>
            <div class="footer-item">✓ No files moved or modified</div>
            <div class="footer-item">✓ Human decisions applied separately</div>
            <div class="footer-item">✓ Inbox accepts work items only</div>
            <div class="footer-item">✓ Review opens file location only</div>
        </div>'''
    
    def load_template(self):
        """Load template.html if it exists, otherwise use inline fallback"""
        if self.template_path.exists():
            print(f"[✓ Using external template: {self.template_path}]")
            with open(self.template_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            print(f"[⚠ Template not found at {self.template_path}, using inline fallback]")
            return self.get_inline_template()
    
    def get_inline_template(self):
        """
        Fallback inline template if template.html doesn't exist
        
        NOTE: Uses SINGLE braces for CSS since we use .replace() not .format()
        The placeholders {header}, {items}, {footer} will be replaced
        """
        return '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>NAVI Mail Room Update</title>
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
            max-width: 1000px;
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
            font-size: 32px;
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

        /* MAIN CONTENT GRID - 300px LEFT, 1fr RIGHT */
        .content-grid {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 32px;
            margin-bottom: 40px;
        }

        @media (max-width: 768px) {
            .content-grid {
                grid-template-columns: 1fr;
            }
        }

        /* FILE CARD */
        .file-card {
            background: #0f1433;
            border-left: 5px solid #f5a623;
            padding: 28px;
            border-radius: 8px;
        }

        .file-card h3 {
            font-size: 22px;
            margin-bottom: 20px;
            color: #ffd700;
            font-weight: 700;
        }

        .file-meta {
            display: flex;
            flex-direction: column;
            gap: 14px;
            margin-bottom: 28px;
        }

        .meta-item {
            display: flex;
            gap: 12px;
            align-items: baseline;
        }

        .meta-label {
            font-size: 16px;
            font-weight: 600;
            color: #a0a8c0;
            min-width: 100px;
        }

        .meta-value {
            font-size: 18px;
            color: #f0f0f0;
        }

        .confidence-badge {
            display: inline-block;
            background: rgba(74, 192, 74, 0.2);
            border: 1px solid #4ac04a;
            color: #7cff7c;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 16px;
            font-weight: 600;
        }

        /* ACTIONS COLUMN - VERTICAL STACK */
        .actions-section {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .action-btn {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 20px;
            border: 2px solid;
            border-radius: 8px;
            background: #0f1433;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
            font-size: 18px;
            font-weight: 600;
            font-family: 'Atkinson Hyperlegible', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .action-icon {
            font-size: 28px;
            line-height: 1;
        }

        .action-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .action-title {
            font-weight: 700;
            font-size: 18px;
        }

        .action-desc {
            font-size: 14px;
            opacity: 0.9;
        }

        /* TRACK (GREEN) */
        .btn-track {
            border-color: #4ac04a;
            color: #7cff7c;
        }

        .btn-track:hover {
            background: rgba(74, 192, 74, 0.1);
        }

        /* HOLD (YELLOW) */
        .btn-hold {
            border-color: #f5a623;
            color: #ffc107;
        }

        .btn-hold:hover {
            background: rgba(245, 166, 35, 0.1);
        }

        /* ESCALATE (RED) */
        .btn-escalate {
            border-color: #e74c3c;
            color: #ff6b6b;
        }

        .btn-escalate:hover {
            background: rgba(231, 76, 60, 0.1);
        }

        /* REASONING SECTION */
        .reasoning {
            background: #0f1433;
            border-left: 5px solid #4a90e2;
            padding: 28px;
            border-radius: 8px;
            margin-bottom: 32px;
        }

        .reasoning h4 {
            font-size: 20px;
            margin-bottom: 18px;
            color: #e8e8ff;
            font-weight: 700;
        }

        .reason-list {
            list-style: none;
        }

        .reason-item {
            font-size: 16px;
            margin-bottom: 12px;
            padding-left: 32px;
            position: relative;
            color: #c8d0e0;
            line-height: 1.6;
        }

        .reason-item::before {
            content: "•";
            position: absolute;
            left: 0;
            font-size: 24px;
            color: #4a90e2;
            line-height: 1;
        }

        /* FOOTER */
        .footer {
            background: #0f1433;
            border-top: 2px solid #1e2749;
            padding: 20px;
            border-radius: 8px;
            font-size: 14px;
            color: #7a8299;
            line-height: 1.8;
        }

        .footer-item {
            margin-bottom: 8px;
        }

        .footer-item:last-child {
            margin-bottom: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        {header}
        
        {items}
        
        {footer}
    </div>
</body>
</html>'''
    
    def generate(self, items_data=None, timestamp=None):
        """Generate the complete HTML presentation"""
        if items_data is None:
            items_data = {
                'filename': 'Client_Notes_Intro.docx',
                'routed_to': 'ACTIVE',
                'confidence': '90% (High)',
                'file_type': 'DOCX',
                'received': '2025-12-15',
                'keywords': 'important, urgent, priority'
            }
        
        # Load template
        template = self.load_template()
        
        # Generate sections
        header_html = self.generate_header(timestamp)
        items_html = self.generate_items(items_data)
        footer_html = self.generate_footer()
        
        # Inject into template
        html = template.replace('{header}', header_html)
        html = html.replace('{items}', items_html)
        html = html.replace('{footer}', footer_html)
        
        # Write to file
        with open(self.output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"[✓ Presenter generated: {self.output_path}]")
        return self.output_path


if __name__ == "__main__":
    # Example usage
    presenter = Presenter()
    
    # Sample data
    sample_data = {
        'filename': 'Client_Notes_Intro.docx',
        'routed_to': 'ACTIVE',
        'confidence': '90% (High)',
        'file_type': 'DOCX',
        'received': '2025-12-15',
        'keywords': 'important, urgent, priority'
    }
    
    presenter.generate(sample_data)
    print("✅ Presenter HTML generated successfully!")