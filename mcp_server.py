# 🐍 VBoarder Plugin Server (REST API)
# Supports: LobeChat Plugin Architecture
# Version: 3.0 (REST Standard)

import json
import os
import sys
import shutil
from http.server import HTTPServer, BaseHTTPRequestHandler

# Configuration
DEFAULT_PORT = 8000
ROOT_DIR = r"D:\05_AGENTS-AI"
PLUGIN_DIR = os.path.join(ROOT_DIR, "01_RUNTIME", "VBoarder", "lobe-chat-plugin")
NAVI_INBOX = os.path.join(ROOT_DIR, "01_PRODUCTION", "OPS_INTAKE_NAVI_v2.0", "inbox")
NAVI_PROCESSING = os.path.join(ROOT_DIR, "01_PRODUCTION", "OPS_INTAKE_NAVI_v2.0", "processing")
NAVI_ARCHIVE = os.path.join(ROOT_DIR, "01_PRODUCTION", "OPS_INTAKE_NAVI_v2.0", "archive")

class PluginServer(BaseHTTPRequestHandler):
    def _set_headers(self, content_type="application/json", status=200):
        self.send_response(status)
        self.send_header("Content-type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        print(f"OPTIONS request from {self.client_address}")

    def do_GET(self):
        print(f"GET request for {self.path} from {self.client_address}")
        # Serve Manifest
        # Serve Manifest
        if self.path == "/manifest.json" or self.path == "/.well-known/ai-plugin.json":
            self.serve_file(os.path.join(PLUGIN_DIR, "manifest.json"))
        # Serve OpenAPI Definition
        elif self.path == "/openapi.json":
            self.serve_file(os.path.join(PLUGIN_DIR, "openapi.json"))
        # Health Check
        elif self.path == "/health":
            self._set_headers()
            self.wfile.write(json.dumps({"status": "healthy", "mode": "REST"}).encode())
        else:
            self._set_headers(status=404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())

    def do_POST(self):
        try:
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode()) if post_data else {}

            response = {}

            if self.path == "/list_inbox":
                if os.path.exists(NAVI_INBOX):
                    files = os.listdir(NAVI_INBOX)
                    response = {"files": files, "count": len(files)}
                else:
                    response = {"files": [], "error": "Inbox not found"}

            elif self.path == "/read_file":
                filename = data.get("filename")
                # Check inbox then processing
                paths = [
                    os.path.join(NAVI_INBOX, filename),
                    os.path.join(NAVI_PROCESSING, filename)
                ]
                content = None
                for p in paths:
                    if os.path.exists(p):
                        try:
                            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                                content = f.read()
                            break
                        except Exception as e:
                            content = f"Error: {str(e)}"
                
                if content is not None:
                    response = {"content": content}
                else:
                    response = {"error": "File not found"}

            elif self.path == "/move_to_processing":
                filename = data.get("filename")
                src = os.path.join(NAVI_INBOX, filename)
                dst = os.path.join(NAVI_PROCESSING, filename)
                
                if os.path.exists(src):
                    if not os.path.exists(NAVI_PROCESSING):
                        os.makedirs(NAVI_PROCESSING)
                    shutil.move(src, dst)
                    response = {"status": "success", "message": f"Moved {filename}"}
                else:
                    response = {"error": "File not found in inbox"}

            else:
                self.send_response(404)
                self.end_headers()
                return

            self._set_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            self._set_headers(status=500)
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def serve_file(self, filepath):
        if os.path.exists(filepath):
            self._set_headers("application/json")
            with open(filepath, "rb") as f:
                self.wfile.write(f.read())
        else:
            self._set_headers(status=404)
            self.wfile.write(json.dumps({"error": "File not found"}).encode())

def run_server(port=DEFAULT_PORT):
    server_address = ("", port)
    httpd = HTTPServer(server_address, PluginServer)
    print(f"🐍 VBoarder Plugin Server running on port {port}")
    print(f"📂 Root: {ROOT_DIR}")
    httpd.serve_forever()

if __name__ == "__main__":
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
