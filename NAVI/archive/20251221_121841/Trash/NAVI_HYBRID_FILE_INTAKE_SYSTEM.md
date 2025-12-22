# 🎯 VBoarder Navi — Hybrid File Drop + Knowledge Base System
## LobeChat Integration Guide with Dual File Processing

---

## 🔄 SYSTEM ARCHITECTURE

### Dual Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  NAVI HYBRID INTAKE SYSTEM                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📥 INPUT LAYER (Two Methods)                              │
│  ├─ Method 1: LobeChat File Drop (Easy - Drag & Drop)     │
│  └─ Method 2: Knowledge Base Upload (For RAG Context)     │
│                                                             │
│  🧠 PROCESSING LAYER                                        │
│  ├─ Parse & Classify (GTD)                                │
│  ├─ Query Knowledge Base for Context (RAG)                │
│  ├─ Generate Action Items                                 │
│  └─ Route to Agents                                       │
│                                                             │
│  📤 OUTPUT LAYER                                            │
│  ├─ Enterprise SOP Report                                 │
│  ├─ Action Item IDs + Assignments                         │
│  ├─ Archive to Filesystem                                 │
│  └─ Notify Assigned Agents                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 METHOD 1: DIRECT FILE DROP (Easy)

### How It Works

1. **Open Navi in LobeChat** → Go to "Navi Thompson" agent
2. **Drag files into chat** → Any file type (PDF, .md, .txt, .eml, images)
3. **Type a command** → "Process this inbox"
4. **Navi processes** → Generates enterprise SOP report
5. **Files auto-archive** → Saved to `D:\05_AGENTS\Navi\outputs\intake_reports\`

### Supported File Types

| Type | Use Case | Processing |
|------|----------|-----------|
| `.txt` | Text notes, action lists | Full parse + GTD classify |
| `.md` | Markdown docs, GTD dumps | Parse, extract structure |
| `.pdf` | Documents, contracts, reports | Text extract + analyze |
| `.eml` | Emails | Parse headers, content, classify |
| `.docx` | Word documents | Extract text + metadata |
| `.xlsx` | Spreadsheets | Parse tables, extract data |
| `.png/.jpg` | Screenshots, images | OCR + text extraction |

### Example Usage

**User:** "Process these files as intake"

**File dropped:**
- client_notes.txt
- GTD_dump.md
- project_proposal.pdf

**User:** "Process this inbox"

**Navi Response:**
```
✅ PROCESSING INITIATED

Reading files...
- client_notes.txt (2.3 KB) — OK
- GTD_dump.md (4.2 KB) — OK  
- project_proposal.pdf (3.8 MB) — OK

Generating Enterprise SOP Report...
[Report generated and saved]

**INTAKE COMPLETE**
✅ 3 files processed
✅ 7 action items generated
✅ 3 departments notified
📁 Archive: D:\05_AGENTS\Navi\outputs\intake_reports\INTAKE_20251209_002.md
```

---

## 📚 METHOD 2: KNOWLEDGE BASE UPLOAD (For RAG Context)

### What is LobeChat Knowledge Base?

A **vector database (RAG)** that stores documents and allows Navi to search for relevant context when processing new files.

**Use case:** If you have company policies, previous decisions, or reference documents, upload them once to the knowledge base. Then Navi can reference them while processing new intake items.

### Setup Knowledge Base in LobeChat

**Step 1: Access Knowledge Base**

```
LobeChat → Settings → Knowledge Base
OR
Navi Agent → Settings → Knowledge Sources
```

**Step 2: Create Knowledge Base**

Name: `VBoarder_Company_Context`  
Description: `Company policies, previous decisions, agent roles`

**Step 3: Upload Documents**

Upload reference documents:
- `D:\05_AGENTS\Navi\memory\company_policies.md`
- `D:\05_AGENTS\Navi\memory\agent_roles.md`
- `D:\05_AGENTS\Navi\memory\routing_rules.md`
- `D:\04_PROJECTS\VBoarder_Handbook.pdf`
- `D:\03_DIVISIONS\Department_Contacts.xlsx`

**Step 4: Enable for Navi**

In Navi's settings:
```
✅ Enable Knowledge Base
Knowledge Source: VBoarder_Company_Context
Search Mode: Vector Search (RAG)
Context Window: 3000 tokens
```

### How RAG Enhances Processing

When Navi processes a file:

1. **User drops:** partnership_proposal.pdf
2. **Navi extracts:** Key topics from proposal
3. **Navi queries KB:** "Find partnership guidelines and past decisions"
4. **KB returns:** Relevant company policies + historical context
5. **Navi enhances:** Report includes policy alignment + lessons from past deals

---

## 🔧 IMPLEMENTATION: HYBRID SYSTEM SETUP

### Phase 1: Enable File Drop in Navi

**File:** `D:\05_AGENTS\Navi\configs\agent_config.json`

```json
{
  "name": "Navi Thompson",
  "title": "AI Administration Specialist & Intake Coordinator",
  "role": "VBoarder Intake Handler",
  "capabilities": {
    "file_drop": true,
    "supported_formats": [
      "txt", "md", "pdf", "docx", "xlsx", 
      "eml", "png", "jpg", "jpeg", "csv"
    ],
    "max_file_size_mb": 50,
    "batch_processing": true,
    "auto_archive": true
  },
  "knowledge_base": {
    "enabled": true,
    "name": "VBoarder_Company_Context",
    "search_type": "vector_rag",
    "max_context_tokens": 3000
  },
  "output": {
    "format": "enterprise_sop",
    "auto_save": true,
    "archive_path": "D:\\05_AGENTS\\Navi\\outputs\\intake_reports\\",
    "notify_agents": true
  }
}
```

### Phase 2: Create Knowledge Base Files

**File 1:** `D:\05_AGENTS\Navi\memory\company_policies.md`

```markdown
# VBoarder Inc. — Company Policies & Guidelines

## Partnership Guidelines
- All partnerships require CEO approval
- Legal review mandatory for contracts >$50K
- Must align with 5-year strategic plan

## Intake Routing Rules
- Client communications → CTO review first
- Technical documents → Technical review queue
- Budget items → CFO approval required
- Executive items → CEO priority

## Approval Thresholds
- Expenses <$1K: Department head approval
- Expenses $1K-$50K: CFO approval required
- Expenses >$50K: CEO + CFO sign-off
```

**File 2:** `D:\05_AGENTS\Navi\memory\agent_roles.md`

```markdown
# VBoarder Inc. — Agent Roles & Responsibilities

## C-Suite Agents
- **CEO**: Strategic decisions, executive approvals, >$50K spending
- **CTO (Bernard)**: Technical strategy, architecture, hiring, <$50K tech spending
- **CFO**: Budget, finance, compliance, expense approval
- **COO**: Operations, resource allocation, process optimization
- **CMO**: Marketing, brand, communications, campaigns

## Support Agents
- **Secretary (Lyra)**: Admin, scheduling, team coordination
- **CLO**: Legal, contracts, compliance, agreements
- **COS**: Chief of Staff, executive support, documentation
- **SEC**: Security, access, infrastructure
- **AIR**: AI Records, archival, compliance, memory management
```

**File 3:** `D:\05_AGENTS\Navi\memory\routing_rules.md`

```markdown
# VBoarder Inc. — Intake Routing Rules

## By Document Type

### Client Communications
- Route to: CTO (Bernard)
- Secondary: Secretary (Lyra) for scheduling
- Archive: D:\04_PROJECTS\ClientPartnerships\

### Technical Documents  
- Route to: CTO (Bernard), COO
- Review time: 24-48 hours
- Archive: D:\04_PROJECTS\TechnicalDocs\

### Executive/Strategic
- Route to: CEO
- Priority: Urgent (same day)
- Archive: D:\04_PROJECTS\Executive\

### Budget/Finance
- Route to: CFO
- Threshold: Approve if <$1K
- Archive: D:\04_PROJECTS\Finance\

### Legal/Contracts
- Route to: CLO
- Priority: High
- Archive: D:\04_PROJECTS\Legal\

### Spam/Rejected
- Move to: Rejected folder
- Archive: D:\04_PROJECTS\Rejected\
```

### Phase 3: Add Navi's System Prompt Instructions

**File:** `D:\05_AGENTS\Navi\prompts\system_prompt.md` (ADD THIS SECTION)

```markdown
## FILE PROCESSING INSTRUCTIONS

When processing files (either dropped or from knowledge base):

### 1. FILE INGESTION
- Accept files from LobeChat file drop (up to 50MB)
- Parse all supported formats
- Extract key information and metadata

### 2. KNOWLEDGE BASE QUERY
- Query the knowledge base for company policies
- Retrieve relevant routing rules
- Get historical context on similar items
- Include policy alignment in recommendations

### 3. PROCESSING PIPELINE
- Classify using GTD methodology
- Apply company routing rules (from KB)
- Generate action items with policy alignment
- Include knowledge base references in report

### 4. OUTPUT FORMAT
- Always use Enterprise SOP format
- Include: Policy compliance check, KB references
- Generate unique action item IDs
- Assign to correct agent (per company roles KB)

### 5. AUTO-ARCHIVING
- Save report to: D:\05_AGENTS\Navi\outputs\intake_reports\
- Create timestamp: INTAKE_YYYYMMDD_XXX.md
- Archive original files (if applicable)
- Log all actions to compliance database

### 6. KNOWLEDGE BASE CONTEXT
When generating reports, reference:
- Relevant company policies
- Historical decisions (from KB)
- Policy alignment statements
- Routing rule justification
```

---

## 🚀 STEP-BY-STEP USER GUIDE

### For End Users (Non-Technical)

**Scenario: You have 4 files to process**

#### Using File Drop (Easiest)

```
1. Open LobeChat → Click "Navi Thompson"

2. Drag files into chat window:
   📄 client_notes.txt
   📄 project_plan.md
   📄 proposal.pdf
   📄 email.eml

3. Type: "Process these files as intake"

4. Navi processes automatically:
   ✅ Reads all files
   ✅ Queries knowledge base for context
   ✅ Generates enterprise report
   ✅ Archives to D:\05_AGENTS\Navi\outputs\

5. Report includes:
   • File summaries
   • GTD classifications
   • Department routing
   • Action item list
   • Policy compliance check
   • Historical context (from KB)
```

#### Alternative: Upload to Knowledge Base First

```
If you want Navi to reference context:

1. Go to Settings → Knowledge Base

2. Upload company reference docs:
   • Company policies
   • Agent contact list
   • Previous decisions
   • Templates

3. Then drop files for processing

4. Navi will automatically cite relevant context
   from the knowledge base in her reports
```

---

## 📊 TECHNICAL ARCHITECTURE

### File Drop Processing Flow

```
┌─────────────────────────────────────┐
│  LobeChat File Drop                 │
│  (Drag & drop files in chat)        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  File Parser                        │
│  • Extract text                     │
│  • Parse metadata                   │
│  • Detect format                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Knowledge Base Query (RAG)         │
│  • Vector search for context        │
│  • Retrieve company policies        │
│  • Get routing rules                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  GTD Classification                 │
│  • Next Actions                     │
│  • Projects                         │
│  • Waiting For                      │
│  • Someday/Maybe                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Agent Routing                      │
│  • Apply company routing rules      │
│  • Assign to departments            │
│  • Generate action items            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Enterprise SOP Report              │
│  • Full processing report           │
│  • Policy compliance check          │
│  • KB context references            │
│  • Action item list                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Auto-Archive & Notify              │
│  • Save to intake_reports/          │
│  • Archive original files           │
│  • Notify assigned agents           │
│  • Log to compliance DB             │
└─────────────────────────────────────┘
```

### Knowledge Base Architecture

```
LobeChat Knowledge Base (Vector DB)
│
├─ PostgreSQL with pgvector
│  └─ Stores embeddings for semantic search
│
├─ S3 Storage (or local)
│  └─ Stores original documents
│
├─ Embedding Model (Ollama nomic-embed-text)
│  └─ Converts text to vectors
│
└─ RAG Integration
   └─ Retrieves context during processing
```

---

## ⚙️ CONFIGURATION CHECKLIST

- [ ] **LobeChat File Drop Enabled**
  - Settings → File Upload enabled
  - Max file size: 50MB
  - Supported formats configured

- [ ] **Knowledge Base Created**
  - Name: `VBoarder_Company_Context`
  - Documents uploaded (policies, roles, rules)
  - Vector search enabled

- [ ] **Navi Configuration Updated**
  - `agent_config.json` updated
  - File drop capability enabled
  - KB search enabled
  - Auto-archive enabled

- [ ] **System Prompt Updated**
  - File processing instructions added
  - KB query instructions added
  - Output format updated

- [ ] **Folder Structure Ready**
  - `D:\05_AGENTS\Navi\outputs\intake_reports\` exists
  - `D:\05_AGENTS\Navi\memory\` populated with policy docs
  - `D:\04_PROJECTS\Intake\Reports\` created

- [ ] **Testing Complete**
  - Drop test files
  - Verify processing
  - Check report generation
  - Verify archival

---

## 🎯 QUICK START (5 Minutes)

### Immediate Setup

**1. Create Knowledge Base Docs** (2 min)

```powershell
# Create memory folder if needed
New-Item -ItemType Directory -Path "D:\05_AGENTS\Navi\memory" -Force

# Create policy file
@"
# Company Policies
- All partnerships need CEO approval
- Tech docs go to CTO (Bernard)
- Financial >$1K needs CFO sign-off
"@ | Set-Content "D:\05_AGENTS\Navi\memory\company_policies.md"

# Create agent roles file
@"
# Agent Roles
- CEO: Executive decisions
- CTO (Bernard): Technical strategy
- CFO: Finance & budgets
- Secretary (Lyra): Scheduling & admin
"@ | Set-Content "D:\05_AGENTS\Navi\memory\agent_roles.md"
```

**2. Upload to LobeChat KB** (2 min)

- Open LobeChat → Settings → Knowledge Base
- Create new KB: `VBoarder_Company_Context`
- Upload those 2 markdown files

**3. Test File Drop** (1 min)

- Open Navi in LobeChat
- Drag a test .txt file into chat
- Say: "Process this file"
- Verify report generates

---

## 📞 SUPPORT & TROUBLESHOOTING

### File Drop Not Working?
- Check: LobeChat file upload enabled in settings
- Check: File size <50MB
- Check: Supported format (.txt, .md, .pdf, etc.)
- Restart LobeChat if needed

### Knowledge Base Not Providing Context?
- Verify: Documents uploaded to KB
- Verify: Vector search enabled in settings
- Check: Embedding model running (Ollama)
- Try: Refresh LobeChat

### Reports Not Auto-Saving?
- Verify: `D:\05_AGENTS\Navi\outputs\intake_reports\` folder exists
- Check: Write permissions on folder
- Verify: `auto_archive: true` in agent_config.json

---

## 📝 FINAL SUMMARY

**What You Can Do Now:**

✅ **Drop files into LobeChat** → Navi processes them instantly  
✅ **Query knowledge base** → Get context from company policies  
✅ **Generate enterprise reports** → Full GTD + routing + action items  
✅ **Auto-archive everything** → Compliance + audit trail  
✅ **Notify team members** → Action items assigned automatically  

**Files Required:**

- `D:\05_AGENTS\Navi\configs\agent_config.json` (updated)
- `D:\05_AGENTS\Navi\prompts\system_prompt.md` (updated)
- `D:\05_AGENTS\Navi\memory\company_policies.md` (new)
- `D:\05_AGENTS\Navi\memory\agent_roles.md` (new)
- `D:\05_AGENTS\Navi\memory\routing_rules.md` (new)

**Next Step:** Implement Phase 1 & 2, test file drop, and you're live.

---

*Hybrid File Drop + Knowledge Base System for VBoarder Navi  
Ready for enterprise file intake processing*
