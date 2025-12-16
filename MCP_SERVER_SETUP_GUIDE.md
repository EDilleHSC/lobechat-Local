# 🚀 MCP SERVER SETUP GUIDE (NAVI RECEPTIONIST VERSION)

## Problem Solved
You were getting "Empty file path" error because you pointed LobeChat to itself (localhost:33250) instead of a separate MCP server.

## ✅ SOLUTION: Navi Receptionist MCP Server (Recommended)

### Step 1: Start the MCP Server
```bash
# Run the persistent server:
D:\05_AGENTS-AI\01_RUNTIME\VBoarder\start_mcp_server_persistent.bat
```

Or run manually:
```bash
cd D:\05_AGENTS-AI\01_RUNTIME\VBoarder
node mcp_server.js
```

### Step 2: Configure LobeChat
1. Open LobeChat at http://localhost:3210 (or your configured port)
2. Go to Settings → Plugins
3. Add MCP Server:
   - **Name**: vboarder-mcp
   - **URL**: http://localhost:8005/mcp
   - **Tools**: Enable all available tools

### Step 3: Test the Connection
Ask your AI: "Check the mail room status" or "List inbox items"

If it works, you'll see mail room status and inbox listings. If not, check the server console for errors.

If it works, you'll see file listings. If not, check the server console for errors.

## 🔧 Available Tools
- **list_directory**: List files in a directory and create snapshots
- **Snapshots created**: JSON files in `NAVI/snapshots/inbox/`
- **Mail Room integration**: Automatic file processing

## 📧 Mail Room Structure
The system maintains deterministic file processing:
- **inbox/**: Files arrive here (NAVI interface)
- **ACTIVE/**: Files being processed (AIR reads from here)
- **WAITING/**: Files waiting for action
- **DONE/**: Completed files
- **snapshots/inbox/**: JSON snapshots (single source of truth)

## 📊 Troubleshooting
- **Port 3001 busy?** Change port in mcp_server.ps1 and LobeChat config
- **Permission errors?** Run as Administrator
- **PowerShell execution policy?** Use -ExecutionPolicy Bypass

## 🎯 What This Enables
Your Navi Receptionist AI can now:
- Check mail room status and inbox contents
- Process incoming messages automatically
- Provide intelligent summaries of communications
- Route messages by priority and urgency
- Maintain zero-inbox policy with organized mail rooms

## 📊 Troubleshooting
- **Port 3002 busy?** Change port in navi_receptionist_mcp_server.js and LobeChat config
- **Permission errors?** Run as Administrator
- **Server crashes?** Check Node.js installation and dependencies

## 📝 Current Status
- ✅ Navi Receptionist MCP server created with mail room tools
- ✅ Official MCP SDK integration
- ✅ Express.js HTTP server setup
- ✅ Sample mail data for testing
- 🔄 Ready for LobeChat integration