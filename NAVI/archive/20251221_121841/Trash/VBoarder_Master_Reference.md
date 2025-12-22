# VBoarder Master Reference
## Core Operating System for File Intake, Routing, and Department Processing

**Status:** Foundation Active (Navi operational)  
**Version:** 1.0  
**Last Updated:** December 10, 2025  

---

## 🎯 CORE PURPOSE

VBoarder operates on a **single principle:**

**Every file → Right person → Right time → Right format**

This document defines HOW we achieve that.

---

## 📁 SYSTEM STRUCTURE (D:\ Drive Governance)

### Root Directory Organization
```
D:\
├─ 01_SYSTEM           Core system services & configs
├─ 02_SOFTWARE         Installed applications & tools
├─ 03_DATA             User data, profiles, exports
├─ 04_PROJECTS         Active projects with docs
├─ 05_AGENTS           ALL VBoarder AI agents & workflows
├─ 06_REVIEW           Ingestion, assessment, compliance
├─ 07_DEVTOOLS         Development, utilities, environments
├─ 08_LOGS             Centralized logging
└─ 09_SHARED_RESOURCES Cross-project reusable assets
```

### Approved Agent Structure (05_AGENTS)
```
D:\05_AGENTS\
└─ [AGENT_NAME]\
    ├─ inbox\           ← Files arrive here
    ├─ processing\      ← AI actively works here
    ├─ archive\         ← Processed & completed files
    ├─ memory\          ← Agent knowledge & learning
    ├─ prompts\         ← System & role-specific prompts
    ├─ logs\            ← Activity logs
    ├─ outputs\         ← Final results & exports
    ├─ configs\         ← Settings (YAML/JSON)
    ├─ templates\       ← Output templates
    └─ README.md        ← Agent description
```

---

## 🚀 CURRENT OPERATIONAL STATE

### Active Components (TODAY)

**1. MAIL ROOM SYSTEM**
- **Location:** `D:\05_AGENTS\NAVI_RECEPTIONIST\`
- **Agent:** Navi Thompson
- **Role:** Primary intake, classification, routing
- **Status:** ✅ Operational with Phase 1 batching

**2. DEPARTMENT STRUCTURE (Routing Targets)**
- Legal
- Marketing
- Finance
- CTO (Technology)
- CFO (Finance/Operations)

**3. FILE FLOW SYSTEM**
- Files → Navi inbox
- Navi classifies
- Files routed to department inbox
- Status tracked until completion
- Files archived after 30 days

---

## 📥 NAVI THOMPSON - MAIL ROOM OPERATIONS

### Location & Structure
```
D:\05_AGENTS\NAVI_RECEPTIONIST\
├─ inbox\              ← New files arrive
├─ Mail_Room\          ← Working directory
│  ├─ ACTIVE\          🔴 (Files needing action)
│  ├─ WAITING\         🔵 (Files blocked/pending)
│  └─ DONE\            ⚫ (Completed/archived)
├─ memory\             ← Learning rules & KB
├─ prompts\            ← System prompts
├─ logs\               ← Session logs
├─ outputs\            ← Reports & extracts
└─ README.md
```

### Navi's Role
1. **Intake** - Receive files from external sources
2. **Classify** - Tag by priority & type
3. **Extract** - Pull key data (amounts, dates, contacts)
4. **Route** - Send to correct department inbox
5. **Track** - Monitor status until completion
6. **Escalate** - Flag blocked items (> 7 days)
7. **Learn** - Improve from corrections

### Priority Classification System
```
[IMMEDIATE]   → Action within 1 hour
              → Legal holds, security, expired deadlines
              → Examples: Critical errors, overdue payments

[24HR]        → Action within 24 hours
              → High-impact decisions, stakeholder approvals
              → Examples: Approvals needed, deadline today

[STANDARD]    → Action within 3-5 days
              → Regular processing, routine items
              → Examples: Reports, standard documents

[HOLD]        → Waiting for external response
              → Blocked on missing info or approvals
              → Examples: Awaiting client feedback, pending info

[ARCHIVE]     → Complete or old files
              → Reference materials
              → Examples: Historical records, completed items
```

### File Routing Rules
```
FILE TYPE DETECTION → DEPARTMENT ASSIGNMENT

If Legal matter:
  → [Legal] inbox

If Marketing/Communications:
  → [Marketing] inbox

If Invoice/Payment/Budget:
  → [Finance] inbox

If Technology/System/Error:
  → [CTO] inbox

If Operations/Organizational:
  → [CFO] inbox

If Unclear:
  → Flag for human review
  → Escalate to CEO/CTO/CFO
```

---

## 🗂️ KNOWLEDGE BASE STRUCTURE

### Location
```
D:\05_AGENTS\SHARED_KNOWLEDGE_BASE\
├─ 01_MASTER_REFERENCE\
│  └─ VBoarder_Master_Reference.md ← YOU ARE HERE
│
├─ 02_MAIL_ROOM\
│  ├─ Navi_System_Prompt.md
│  ├─ Mail_Room_Operations.md
│  ├─ Phase_Rollout_Checklist.md
│  ├─ Classification_Rules.md
│  ├─ Department_Routing.md
│  ├─ Exception_Handler.md
│  ├─ Retrospective_Generator.md
│  ├─ Problems_Tracker.md
│  └─ Auto_Learner.md
│
├─ 03_DEPARTMENTS\
│  ├─ Legal_Department.md
│  ├─ Marketing_Department.md
│  ├─ Finance_Department.md
│  ├─ CTO_Department.md
│  └─ CFO_Department.md
│
├─ 04_POLICIES\
│  ├─ Approval_Thresholds.md
│  ├─ Escalation_Procedures.md
│  ├─ File_Classification_Rules.md
│  ├─ Compliance_Requirements.md
│  └─ Data_Handling.md
│
├─ 05_PROCEDURES\
│  ├─ Daily_Workflow.md
│  ├─ Weekly_Retrospective.md
│  ├─ Exception_Handling.md
│  ├─ Interruption_Protocol.md
│  └─ Learning_Protocol.md
│
└─ 06_FUTURE_AGENTS\
   ├─ Agent_Template.md
   ├─ Department_Agent_Integration.md
   ├─ How_to_Build_Legal_Agent.md
   ├─ How_to_Build_Finance_Agent.md
   └─ How_to_Build_CTO_Agent.md
```

### How to Use Knowledge Base
1. **Find what you need** - Browse structure above
2. **Read relevant document** - Cited as [Source: KB/path/filename.md]
3. **Follow procedures** - Documents contain step-by-step workflows
4. **Update when changed** - Procedures change? Update KB immediately
5. **Notify others** - Let team know KB has been updated

---

## 🔄 DAILY WORKFLOW

### Morning (9am)
```
1. Navi reports overnight status
   "X files processed, Y% accuracy"

2. You review new files in ACTIVE folder
   - Check [IMMEDIATE] items
   - Scan [24HR] items
   - Verify routing looks correct

3. If correct: Approve batch
   If wrong: Correct specific files
   Navi learns from corrections

4. Start day
```

### Throughout Day
```
- New files arrive in Navi's inbox
- Navi batches & processes
- You approve ("OK") or correct ("NO")
- Files move to department inboxes
- Status tracked in WAITING folder
```

### End of Day (5pm)
```
1. Run: /session end
2. Review daily summary
3. Note any problems
4. Log for weekly review
```

---

## 📊 WEEKLY WORKFLOW (CRITICAL)

### Sunday 8am - Retrospective & Planning
```
1. Run: /retrospective week

2. Review metrics:
   - Files processed
   - Navi accuracy %
   - Your corrections
   - Learning trends

3. Identify problems:
   - What failed?
   - Why did it fail?
   - How to fix?

4. Plan improvements:
   - Implement 1-2 fixes
   - Update KB if needed
   - Test changes

5. Check phase readiness:
   - Ready to increase batch size?
   - Ready to reduce human time?
   - Any blockers?
```

---

## 🚨 ESCALATION PROCEDURES

### When to Escalate

**Immediate escalation (call/email):**
- File > 7 days in WAITING
- Security or legal issue
- Emergency/urgent
- Critical error affecting others

**End-of-day escalation:**
- Navi's accuracy dropped significantly
- Pattern of misclassifications
- System error
- Department can't handle assigned file

**Weekly escalation (retrospective):**
- Same problem recurring
- Process breaking down
- Need policy change
- New approval threshold needed

### Escalation Path
```
FILE ISSUE → Navi flags → You review → CEO/CTO/CFO
              (within 1 hour if urgent)

PROCESS ISSUE → Identified in retrospective → Plan fix → Implement
                (within 1 week)

POLICY ISSUE → Identified in retrospective → Document → Approve → Update KB
              (within 2 weeks)
```

---

## 📈 PHASE PROGRESSION (Phased Rollout)

### Phase 1: Foundation (Weeks 1)
- Batch size: 5 files
- Your time: 20 min/day
- Navi accuracy target: 95%
- Goal: Prove system works

### Phase 2: Growth (Week 2)
- Batch size: 10 files
- Your time: 15 min/day
- Navi accuracy target: 95%+
- Goal: Handle normal volume

### Phase 3: Scale (Weeks 3-4)
- Batch size: 20 files
- Your time: 10 min/day
- Navi accuracy target: 97%+
- Goal: Mostly autonomous

### Phase 4: Production (Day 30+)
- Batch size: Unlimited
- Your time: 5 min/day
- Navi accuracy target: 98%+
- Goal: Hands-off operation

**Advancement criteria:** Meet accuracy AND time goals for phase before advancing.

---

## 🏗️ FUTURE STATE - BUILDING DEPARTMENT AGENTS

### When Ready (Future)
As you build individual department agents:

1. **Create agent folder** in `D:\05_AGENTS\[DEPT]_AGENT\`
2. **Use approved structure** (inbox, processing, archive, memory, etc.)
3. **Create department-specific prompt** - Inherits this Master Reference
4. **Copy KB docs** to agent's memory folder
5. **Agent takes over inbox** - Handles department items
6. **Reports to Navi** - Status updates on progress
7. **Navi remains orchestrator** - Routes files, tracks overall flow

### Example: When Finance Agent is Built
```
D:\05_AGENTS\FINANCE_AGENT\
├─ inbox\              ← Finance items from Navi
├─ processing\         ← Agent works on invoices, payments
├─ archive\            ← Completed finance work
├─ memory\
│  └─ Approval_Thresholds.md  ← Copy from KB
├─ prompts\            ← Finance-specific system prompt
├─ logs\               ← Finance agent activity logs
└─ outputs\            ← Reports, summaries, exports

Workflow:
Navi routes invoice → Finance Agent inbox
Agent processes invoice
Agent reports status to Navi: "Processing", "Needs approval", "Complete"
Navi tracks overall progress
Invoice completes → Moves to archive
```

---

## 💼 CURRENT DEPARTMENT DEFINITIONS

### LEGAL
- **Handles:** Contracts, legal opinions, compliance, disputes
- **Receives:** Legal documents, regulatory items, contracts
- **Examples:** NDA review, compliance check, legal opinion request
- **Future Agent:** [To be built]

### MARKETING
- **Handles:** Campaigns, content, brand, communications
- **Receives:** Campaign requests, content approvals, analytics
- **Examples:** Campaign brief, content approval, brand guidelines
- **Future Agent:** [To be built]

### FINANCE
- **Handles:** Invoices, payments, budgets, financial reports
- **Receives:** Invoices, payment requests, budget items
- **Examples:** Invoice for payment, expense report, budget proposal
- **Future Agent:** [To be built]

### CTO (Technology)
- **Handles:** Technical issues, system errors, technology decisions
- **Receives:** Error logs, technical requests, infrastructure items
- **Examples:** System error, feature request, infrastructure change
- **Future Agent:** [To be built]

### CFO (Operations/Finance)
- **Handles:** Strategic operations, organizational decisions, compliance
- **Receives:** Strategic items, org changes, compliance matters
- **Examples:** Policy change, organizational restructure, compliance report
- **Future Agent:** [To be built]

---

## 🔐 GOVERNANCE & COMPLIANCE

### D:\ Drive Rules (From Governance Policy)
- ✅ Only approved numbered folders at root (01-09)
- ✅ No loose files
- ✅ No unauthorized folders
- ✅ Each agent has required folders (inbox, memory, logs, prompts)
- ✅ All logs go to 08_LOGS or agent's logs/ folder
- ✅ All shared KB in 09_SHARED_RESOURCES or 05_AGENTS\SHARED_KNOWLEDGE_BASE\

### File Handling Rules
- ✅ All files through Navi inbox first
- ✅ Files cannot skip departments
- ✅ Classified files must include tags
- ✅ Routed files tracked in WAITING
- ✅ Completed files moved to DONE after 30 days

### Logging Rules
- ✅ Session logs in `D:\08_LOGS\Navi\` or `D:\05_AGENTS\NAVI_RECEPTIONIST\logs\`
- ✅ All processing tracked
- ✅ All corrections logged
- ✅ Weekly retrospectives archived
- ✅ Retention: 1 year minimum

### AIR Oversight (Automatic)
- ✅ Monitors D:\ structure integrity
- ✅ Flags misplaced files
- ✅ Enforces folder structure
- ✅ Ensures KB consistency
- ✅ Tracks all movements

---

## 📋 QUICK REFERENCE - COMMON COMMANDS

```
PROCESSING:
/process batch          → Start batch (5-20 files depending on phase)
/interrupt filename     → Handle urgent file immediately
OK / NO / HOLD / REDO   → Your decisions on files

REVIEW & TRACKING:
/session end            → End session, log results
/daily summary          → Today's work summary
/retrospective week     → Sunday weekly review (CRITICAL)

MANAGEMENT:
/problem [issue]        → Report a problem
/improve                → Show improvement opportunities
/learning-status        → What Navi has learned
/metrics                → Performance metrics
/phase-check            → Ready for next phase?
```

---

## 📚 HOW TO USE THIS DOCUMENT

**For Daily Work:**
- Reference this for file routing rules
- Check escalation procedures
- Follow daily workflow

**For Weekly Work:**
- Follow retrospective procedure (Sunday)
- Use phase checklist to verify readiness
- Update KB if procedures changed

**For Building Agents (Future):**
- Use as foundation for new agent prompts
- Copy relevant KB sections to new agent memory
- Follow department agent integration guide

**For Troubleshooting:**
- Check escalation procedures
- Review problem-solving section in KB
- Document issue and solution for KB update

---

## 🎯 SUCCESS METRICS

### Daily Metrics
- Files processed: Count
- Navi accuracy: %
- Your corrections: Count
- Time spent: Minutes

### Weekly Metrics (Sunday Retrospective)
- Total files this week
- Accuracy trend
- Learning improvement
- Phase readiness

### Monthly Metrics
- Files processed
- System reliability
- Department satisfaction
- Scaling readiness

---

## ❓ QUESTIONS? NEED HELP?

**Check knowledge base:**
```
D:\05_AGENTS\SHARED_KNOWLEDGE_BASE\
```

**Key documents for common questions:**
- How does Navi work? → 02_MAIL_ROOM\Navi_System_Prompt.md
- How do I classify files? → 02_MAIL_ROOM\Classification_Rules.md
- Where does file go? → 02_MAIL_ROOM\Department_Routing.md
- What if something breaks? → 04_POLICIES\Escalation_Procedures.md
- How do I build an agent? → 06_FUTURE_AGENTS\Agent_Template.md

---

## 📝 DOCUMENT GOVERNANCE

**Last Updated:** December 10, 2025  
**Version:** 1.0  
**Owner:** VBoarder Operations  
**Next Review:** January 10, 2026  

**To Update This Document:**
1. Make changes in `D:\05_AGENTS\SHARED_KNOWLEDGE_BASE\01_MASTER_REFERENCE\`
2. Update "Last Updated" date
3. Increment version number
4. Notify team of changes
5. Update related KB documents if needed

---

## 🚀 NEXT STEPS

1. **Week 1:** Run Phase 1 with Navi (5-file batches)
2. **Every Day:** Follow daily workflow
3. **Every Sunday:** Run retrospective
4. **When Ready:** Advance phases based on metrics
5. **When Needed:** Build department agents following template

**You're ready to operate. Good luck!** ✨
