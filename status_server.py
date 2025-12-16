# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
VBoarder NAVI Status Server
HTTP endpoint for system health monitoring
"""

import json
import os
from pathlib import Path
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

# Configuration
NAVI_DIR = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
STATUS_FILE = os.path.join(NAVI_DIR, 'system_status.json')
PORT = 8006

class StatusHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health' or self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            # Load current status
            try:
                if os.path.exists(STATUS_FILE):
                    with open(STATUS_FILE, 'r') as f:
                        status = json.load(f)
                else:
                    status = {"error": "Status file not found"}
            except Exception as e:
                status = {"error": f"Failed to load status: {str(e)}"}

            self.wfile.write(json.dumps(status, indent=2).encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error": "Not found"}')

    def log_message(self, format, *args):
        # Suppress default logging
        pass

def run_server():
    """Run the HTTP server"""
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, StatusHandler)
    print(f"[STATUS] Status server running on port {PORT}")
    print(f"[STATUS] Health endpoint: http://localhost:{PORT}/health")
    httpd.serve_forever()

def main():
    """Start the status server"""
    print("[STATUS] VBoarder NAVI Status Server")
    print("=" * 40)

    # Start server in background thread
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    print("[STATUS] Server started successfully")
    print("[INFO] Press Ctrl+C to stop")

    try:
        # Keep main thread alive
        server_thread.join()
    except KeyboardInterrupt:
        print("\n[STATUS] Server stopped")

if __name__ == "__main__":
    main()