# VBoarder System Architecture

## Overview
VBoarder implements a deterministic agent architecture with clear separation of concerns between interface (NAVI), decision-making (AIR), and execution (Mail Room).

## Core Principles

### 1. Single Source of Truth
- **Snapshots are authoritative** - All system state flows through JSON snapshots
- No agent touches files directly except the Mail Room runner
- All operations are logged and traceable through snapshots

### 2. Strict Separation of Concerns
- **NAVI ≠ AIR** - NAVI is interface only, AIR makes decisions
- NAVI triggers actions, AIR processes results
- Clean handoff through snapshot-based communication

### 3. Deterministic Execution
- AIR reads from `ACTIVE/` directory
- Decisions based on snapshot metadata + file content
- No real-time file manipulation by agents

## Component Architecture

### NAVI (North American Virtual Intelligence)
**Role**: User interface and action trigger
- Accepts user requests
- Calls MCP tools (e.g., `list_directory`)
- **Never touches files directly**
- **Never makes decisions**

**Output**: JSON snapshots in `snapshots/inbox/`

### AIR (Autonomous Intelligence Runtime)
**Role**: Decision engine
- Reads from `ACTIVE/` directory
- Processes files based on snapshot metadata
- Makes deterministic decisions
- **Never triggers actions directly**

**Input**: Files in `ACTIVE/` + corresponding snapshots

### Mail Room
**Role**: Physical file operations executor
- Reads latest snapshots from `snapshots/inbox/`
- Moves files: `inbox/` → `ACTIVE/` → `WAITING/` → `DONE/`
- **Only component that touches files**
- Runs as headless automation

## MCP Server Requirements

### Absolute Rules
1. **MCP server must not format output** - Return raw data only
2. **MCP server must always respond** - Every request gets an HTTP response
3. **MCP server must write snapshots** - Tool execution creates JSON artifacts
4. **No silent failures** - All errors return proper JSON-RPC responses

### Implementation
```javascript
// ✅ CORRECT - Always responds
app.post('/mcp', (req, res) => {
  try {
    // Process request
    // Write snapshot
    res.json({ jsonrpc: '2.0', result: data, id });
  } catch (err) {
    res.status(500).json({ jsonrpc: '2.0', error: err, id });
  }
});

// ❌ WRONG - No response sent
app.post('/mcp', (req, res) => {
  // Process request
  // No res.send() or res.json()
});
```

## Directory Structure
```
NAVI/
├── inbox/           # Files arrive here (NAVI interface)
├── snapshots/inbox/ # JSON snapshots (single source of truth)
├── ACTIVE/          # Files being processed (AIR reads from here)
├── WAITING/         # Files waiting for action
└── DONE/            # Completed files
```

## Data Flow
1. User → NAVI → MCP tool call
2. MCP Server → Lists directory + writes snapshot + responds
3. Mail Room → Reads snapshot + moves files to ACTIVE
4. AIR → Reads ACTIVE + makes decisions
5. AIR → Updates snapshots + moves files through states

## Testing
- Mail Room runner validates snapshot processing
- AIR integration tests read from ACTIVE/
- End-to-end tests: NAVI → snapshot → file movement → AIR decision

## Deployment
- One MCP server instance
- Mail Room runs as scheduled job
- AIR monitors ACTIVE/ directory
- All components stateless except file system