# VBoarder Agent Population in LobeChat
## UI Population, Sub-Agents, and Group Management

---

## PART 1: AGENT POPULATION METHODS

### Method 1: MANUAL CREATION (in LobeChat UI)

**Location:** LobeChat Settings → Assistants (or "Agents")

**Steps:**

```
1. Open LobeChat: http://localhost:3210
2. Click "Create Assistant" (or + button)
3. Fill in:
   - Agent Name: "Navi Thompson"
   - Description: "Intelligent VBoarder Receptionist"
   - Avatar: [Upload image]
   - System Prompt: [Paste AGENT_SYSTEM_PROMPT_v3.md content]
   - Model: GLM-4.6V-Flash
   - Temperature: 0.7
   - Max tokens: 2000
4. Add Tools: [List all MCP tools]
5. Save ✅
```

**Time Required:** 5-10 minutes per agent

**Best For:** Quick testing, small number of agents

---

### Method 2: BATCH/AUTOMATED POPULATION

**Option A: Via Agent Template JSON (LobeChat Native)**

LobeChat supports importing agents from JSON files.

```json
{
  "id": "navi-thompson",
  "name": "Navi Thompson",
  "description": "VBoarder Receptionist - Intelligent inbox processing",
  "avatar": "https://[url-to-avatar]",
  "systemPrompt": "[Full system prompt content]",
  "model": {
    "provider": "ollama",
    "name": "GLM-4.6V-Flash"
  },
  "settings": {
    "temperature": 0.7,
    "top_p": 0.9,
    "frequency_penalty": 0,
    "presence_penalty": 0
  },
  "tools": [
    "list_inbox",
    "read_file",
    "archive_file",
    "move_to_processing",
    "classify_file",
    "create_summary",
    "route_to_agent",
    "update_status",
    "generate_report"
  ]
}
```

**How to Import:**
1. Create file: `navi_thompson_agent.json`
2. In LobeChat: Settings → Import → Select JSON file
3. Agent auto-populates ✅

**Time Required:** 1 minute per agent

**Best For:** Quick setup, many agents

---

### Method 3: DATABASE-DRIVEN (For All 17 Agents)

**Using LobeChat's Database (PostgreSQL or Local)**

```sql
-- Agent table structure
INSERT INTO agents (
  id,
  name,
  description,
  system_prompt,
  model_id,
  temperature,
  tools,
  tags,
  created_at
) VALUES (
  'navi-thompson',
  'Navi Thompson',
  'VBoarder Receptionist - Intelligent inbox processing',
  '[SYSTEM_PROMPT_v3.md content]',
  'glm-4.6v-flash',
  0.7,
  '["list_inbox", "read_file", ...]',
  '["receptionist", "filing", "gtd"]',
  NOW()
);

-- Repeat for 16 more agents
INSERT INTO agents (...) VALUES ('air', 'AIR', ...);
INSERT INTO agents (...) VALUES ('money_penny', 'Money Penny', ...);
-- etc.
```

**Then in LobeChat:**
1. Enable Database: Settings → Database → PostgreSQL
2. All agents automatically load ✅
3. Add/edit agents directly in UI

**Time Required:** 15 minutes setup, then instant

**Best For:** Production, scalable, 17+ agents

---

## PART 2: AGENT CONFIGURATION REQUIREMENTS

### Essential Fields for Each Agent

```json
{
  "Agent": "Navi Thompson",
  "Role": "Receptionist",
  "System Prompt": "AGENT_SYSTEM_PROMPT_v3.md",
  "Model": "GLM-4.6V-Flash",
  "KB Reference": "KB Sections 2.1, 4.1",
  "Memory Files": "D:\\05_AGENTS-AI\\Navi_Thompson\\memory\\",
  "Tools": [
    "list_inbox",
    "read_file",
    "archive_file",
    "move_to_processing",
    "classify_file",
    "create_summary",
    "route_to_agent",
    "update_status",
    "generate_report"
  ],
  "Model Settings": {
    "temperature": 0.7,
    "top_p": 0.9,
    "max_tokens": 2000
  },
  "Tags": ["receptionist", "filing", "gtd", "automation"]
}
```

---

## PART 3: SUB-AGENTS (Hierarchical Structure)

### What Are Sub-Agents?

Sub-agents are agents that work UNDER a parent agent, performing specific tasks.

```
EXAMPLE HIERARCHY:

Navi Thompson (Parent Agent)
├── File Classifier (Sub-agent)
│   └── Task: Classify files by priority
├── Entity Extractor (Sub-agent)
│   └── Task: Extract emails, dates, amounts
├── GTD Organizer (Sub-agent)
│   └── Task: Apply GTD methodology
└── Router (Sub-agent)
    └── Task: Route to appropriate VBoarder agent
```

### How Sub-Agents Work in LobeChat

**Option 1: Agent Calling (Recommended)**

```
LobeChat supports agent-to-agent calls via tools/plugins

Navi's tool: "route_to_agent"
├── Calls: "invoke_agent(agent_name, task)"
├── Target: Money Penny, AIR, Bernard, etc.
└── Returns: Result back to Navi
```

**Configuration:**

```json
{
  "agent_name": "Navi Thompson",
  "tools": [
    {
      "name": "route_to_agent",
      "description": "Route task to another VBoarder agent",
      "parameters": {
        "agent_name": "string",
        "task": "string",
        "priority": "string"
      }
    }
  ]
}
```

**Usage Example:**

```
User: "This contract needs legal review"

Navi:
1. Recognizes it's a contract
2. Calls: route_to_agent(Legal_Team, "Contract review", "HIGH")
3. Legal_Team (sub-agent) processes
4. Returns: "Contract reviewed. Flagged clauses: X, Y, Z"
5. Navi reports back to user
```

---

### Option 2: Sequential Sub-Agent Workflow

```
Navi receives file
    ↓
Step 1: File Classifier sub-agent
    ├─ Classify by type
    ├─ Set priority
    └─ Store classification
    ↓
Step 2: Entity Extractor sub-agent
    ├─ Extract emails
    ├─ Extract dates
    ├─ Extract amounts
    └─ Store entities
    ↓
Step 3: GTD Organizer sub-agent
    ├─ Assign GTD category
    ├─ Set action level
    └─ Store classification
    ↓
Step 4: Router sub-agent
    ├─ Determine destination agent
    ├─ Check availability
    └─ Route file
    ↓
Final: Report back to user
```

---

## PART 4: AGENT GROUPS

### What Are Agent Groups?

Agent Groups are collections of related agents that work together on shared tasks.

```
GROUP 1: OPERATIONS TEAM
├── Navi Thompson (Receptionist)
├── Money Penny (Executive Assistant)
├── Bernard Giyfoyle (CTO)
└── AIR (Knowledge Manager)

GROUP 2: SPECIALIZED AGENTS
├── Finance Agent
├── Legal Agent
├── Marketing Agent
└── HR Agent

GROUP 3: SUPPORT AGENTS
├── Debugging Agent
├── Documentation Agent
├── Testing Agent
└── Deployment Agent
```

---

### How to Create Agent Groups in LobeChat

**Method 1: Manual Groups (UI)**

```
In LobeChat:
1. Settings → Agent Groups (or Collections)
2. Click "Create Group"
3. Name: "Operations Team"
4. Description: "Core VBoarder operational agents"
5. Add Members:
   - Navi Thompson ✅
   - Money Penny ✅
   - Bernard Giyfoyle ✅
   - AIR ✅
6. Save ✅
```

**Method 2: Database-Driven Groups**

```sql
-- Create agent_groups table
CREATE TABLE agent_groups (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP
);

-- Insert groups
INSERT INTO agent_groups VALUES
('ops-team', 'Operations Team', 'Core operational agents', NOW()),
('specialized', 'Specialized Agents', 'Domain-specific agents', NOW()),
('support', 'Support Agents', 'Technical support agents', NOW());

-- Create group_members table
CREATE TABLE group_members (
  group_id VARCHAR(50),
  agent_id VARCHAR(50),
  PRIMARY KEY (group_id, agent_id),
  FOREIGN KEY (group_id) REFERENCES agent_groups(id)
);

-- Add members to groups
INSERT INTO group_members VALUES
('ops-team', 'navi-thompson'),
('ops-team', 'money-penny'),
('ops-team', 'bernard-giyfoyle'),
('ops-team', 'air');
```

---

### Group Benefits

```
✅ Quick switching between related agents
✅ Shared context across agents
✅ Organized conversation history
✅ Topic grouping by department
✅ Team collaboration workflows
```

---

## PART 5: COMPLETE POPULATION STRATEGY

### For VBoarder (17 Agents)

**Step 1: Prepare Agent Templates**

```
Create 17 JSON files:
✅ 01_navi_thompson.json
✅ 02_air.json
✅ 03_money_penny.json
✅ 04_bernard_giyfoyle.json
✅ 05-17_other_agents.json

Location: D:\02_SOFTWARE-Tools\agent_templates\
```

**Step 2: Set Up LobeChat Database**

```
Option A (Local):
- Use LobeChat's local SQLite
- Auto-syncs across devices
- Good for <100 agents

Option B (Production):
- Use PostgreSQL
- Centralized management
- Best for 17+ agents with teams
```

**Step 3: Bulk Import Agents**

```
Method 1: Via UI
1. Open LobeChat Settings
2. Import → Select all 17 JSON files
3. Wait for completion ✅

Method 2: Via Database
1. Run SQL script to insert all 17 agents
2. LobeChat auto-loads ✅
3. Verify in UI ✅
```

**Step 4: Configure Groups**

```
Create 3 Groups:
1. "Operations Team" (Navi, Money Penny, Bernard, AIR)
2. "Specialized Agents" (Finance, Legal, etc.)
3. "Support Agents" (Debug, Docs, Test, Deploy)
```

**Step 5: Set Up Sub-Agent Routing**

```
For Each Agent:
1. Enable "route_to_agent" tool
2. Configure allowed targets
3. Set routing rules
4. Test agent-to-agent calls
```

---

## PART 6: MANUAL VS AUTOMATIC COMPARISON

| Aspect | Manual | Automated |
|--------|--------|-----------|
| **Time per agent** | 5-10 min | 30 sec |
| **Time for 17 agents** | 85-170 min | 8.5 min |
| **Errors** | Higher | Lower |
| **Consistency** | Variable | Perfect |
| **Scalability** | Poor | Excellent |
| **Best for** | 1-3 agents | 17+ agents |

**Recommendation:** Use Automated (Database + JSON)

---

## PART 7: DETAILED SETUP (AUTOMATED)

### Step 1: Create Agent Template File

```json
[
  {
    "id": "navi-thompson",
    "name": "Navi Thompson",
    "description": "VBoarder Receptionist - Intelligent inbox processing",
    "avatar": "https://[url]/navi.png",
    "systemPrompt": "[Content of AGENT_SYSTEM_PROMPT_v3.md]",
    "model": {
      "provider": "ollama",
      "name": "GLM-4.6V-Flash"
    },
    "settings": {
      "temperature": 0.7,
      "top_p": 0.9,
      "max_tokens": 2000
    },
    "tools": ["list_inbox", "read_file", "archive_file", ...],
    "tags": ["receptionist", "filing", "gtd"],
    "knowledgeBase": "KB Sections 2.1, 4.1",
    "memory_path": "D:\\05_AGENTS-AI\\Navi_Thompson\\memory\\"
  },
  {
    "id": "air",
    "name": "AIR",
    "description": "Archivist & Intelligence Research Director",
    "avatar": "https://[url]/air.png",
    ...
  },
  // ... 15 more agents
]
```

### Step 2: Import into LobeChat

**Option A: Via UI**
```
1. Settings → Agents
2. Click "Import"
3. Select agent_template.json
4. Click "Import All"
5. Wait ✅
```

**Option B: Via Database**
```powershell
# PowerShell script to bulk insert
$agents = Get-Content "agents.json" | ConvertFrom-Json

foreach ($agent in $agents) {
    $query = @"
    INSERT INTO agents (id, name, description, system_prompt, model_id) 
    VALUES ('$($agent.id)', '$($agent.name)', '$($agent.description)', 
            '[prompt]', 'glm-4.6v-flash');
    "@
    # Execute query
}
```

### Step 3: Verify Population

```
In LobeChat:
1. Check sidebar for all 17 agents
2. Click each agent to verify
3. Test agent-to-agent routing
4. Confirm memory files linked
```

---

## PART 8: AGENT COMMUNICATION & SUB-ROUTING

### How Agents Call Each Other

```
Navi: "This contract needs legal review"
    ↓
System detects: route_to_agent("legal_team", contract)
    ↓
Legal_Team Agent receives contract
    ↓
Processes + returns: "Review complete: Flagged clauses X, Y, Z"
    ↓
Navi reports: "Legal review done. See: X, Y, Z"
```

### Tool Configuration for Inter-Agent Calls

```json
{
  "tool_name": "route_to_agent",
  "description": "Route task to another agent",
  "parameters": {
    "target_agent": "string (valid agent ID)",
    "task_description": "string",
    "priority": "URGENT|HIGH|MEDIUM|LOW",
    "context": "object (additional context)"
  },
  "allowed_targets": [
    "air",
    "money_penny",
    "bernard_giyfoyle",
    "legal_team",
    "finance_team"
  ]
}
```

---

## PART 9: PRODUCTION DEPLOYMENT

### For Your VBoarder System

**Recommended Approach:**

```
✅ Use: Database-driven (PostgreSQL)
✅ Import: All 17 agents via JSON
✅ Groups: 3 groups (Operations, Specialized, Support)
✅ Sub-agents: Enable inter-agent routing
✅ Memory: All agents linked to memory folders
✅ Models: GLM-4.6V-Flash primary, GPT-4.1 backup

Timeline:
- Setup: 30 minutes
- Import agents: 5 minutes
- Configure groups: 10 minutes
- Test routing: 15 minutes
- Total: 1 hour
```

---

## SUMMARY

### Manual Population
```
❌ For 17 agents: 85-170 minutes
✅ Best for: Testing 1-2 agents
```

### Automated Population
```
✅ For 17 agents: ~15 minutes
✅ Best for: Production deployment
✅ Method: JSON import or Database insert
```

### Sub-Agents
```
✅ Enabled via: route_to_agent() tool
✅ Allows: Agent-to-agent communication
✅ Benefits: Specialized task handling
```

### Agent Groups
```
✅ Organize: Related agents together
✅ Enable: Quick context switching
✅ Improve: Team collaboration
```

---

**Recommendation for You:**

1. **This Week:** 
   - Create 17 agent JSON templates
   - Import via LobeChat UI (15 min)

2. **Next Week:**
   - Set up PostgreSQL database
   - Migrate to database-driven (scalable)

3. **Production:**
   - All 17 agents configured
   - 3 groups established
   - Inter-agent routing active

**Expected Timeline:** Complete by end of week 🚀
