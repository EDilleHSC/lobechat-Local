# 🛣️ VBoarder Inc. — Intake Routing & Processing Rules

## Quick Routing Guide

### When You Drop Files Into Navi, This Is How They Get Routed

---

## ROUTING BY DOCUMENT TYPE

### 1️⃣ CLIENT COMMUNICATIONS & PARTNERSHIPS

**What It Looks Like:**
- Emails from clients
- Partnership inquiries
- Client meeting notes
- Account information
- Contract proposals

**Routing Assignment:**
- **Primary:** CTO (Bernard) — Technical validation
- **Secondary:** Secretary (Lyra) — Scheduling meetings
- **Tertiary:** CMO — Brand/marketing check

**Priority Level:** 🟠 HIGH (24-48 hour review)

**Process:**
1. Navi reads file
2. Routes to CTO for technical assessment
3. If meeting needed → Lyra schedules
4. Generate action items
5. Archive to: `D:\04_PROJECTS\ClientPartnerships\`

**Action Items Generated:**
- [ ] CTO: Review client technical requirements
- [ ] Lyra: Schedule partnership meeting
- [ ] CMO: Assess marketing alignment
- [ ] CEO: Final partnership approval (if >$50K deal)

**Example:**
```
File: partnership_proposal.pdf
↓
CTO (Bernard): Does our tech align?
↓
Lyra: Schedule meeting with client
↓
CEO: Do we want to pursue this?
```

---

### 2️⃣ TECHNICAL DOCUMENTS & ARCHITECTURE

**What It Looks Like:**
- System diagrams
- Architecture proposals
- Technical specifications
- Code documentation
- Infrastructure plans
- API documentation

**Routing Assignment:**
- **Primary:** CTO (Bernard) — Technical review
- **Secondary:** COO — Operations impact
- **Tertiary:** SEC — Security implications

**Priority Level:** 🟡 MEDIUM (48-72 hour review)

**Process:**
1. Navi extracts technical content
2. Routes to CTO for architecture review
3. COO assesses operational impact
4. SEC evaluates security
5. Generate recommendations
6. Archive to: `D:\04_PROJECTS\TechnicalDocs\`

**Action Items Generated:**
- [ ] CTO: Technical review & validation
- [ ] COO: Assess operational feasibility
- [ ] SEC: Security architecture review
- [ ] CTO: Implementation recommendations
- [ ] Budget approval (if project funding needed)

**Example:**
```
File: system_architecture.pdf
↓
CTO (Bernard): Is design sound?
↓
COO: Can we operationalize this?
↓
SEC: Any security concerns?
↓
CTO: Implementation plan
```

---

### 3️⃣ EXECUTIVE & STRATEGIC ITEMS

**What It Looks Like:**
- CEO reports
- Strategic plans
- Board materials
- Company announcements
- Major decisions
- Annual planning

**Routing Assignment:**
- **Primary:** CEO — Executive authority
- **Secondary:** COS — Documentation & coordination
- **Tertiary:** All Department Heads — Awareness

**Priority Level:** 🔴 URGENT (same-day review)

**Process:**
1. Navi flags as URGENT
2. Routes to CEO immediately
3. COS creates documentation
4. Department heads notified
5. Generate action items
6. Archive to: `D:\04_PROJECTS\Executive\`

**Action Items Generated:**
- [ ] CEO: Review & decision required (TODAY)
- [ ] COS: Create communications package
- [ ] All Depts: Implementation planning
- [ ] COS: Document decision & rationale
- [ ] AIR: Archive for compliance

**Example:**
```
File: strategic_plan_2026.md
↓
CEO: Strategy review URGENT (today)
↓
COS: Prepare communications
↓
All Teams: Begin planning implementation
```

---

### 4️⃣ BUDGET & FINANCIAL DOCUMENTS

**What It Looks Like:**
- Budget requests
- Expense reports
- Financial proposals
- Investment analyses
- Cost estimates
- Purchase requests

**Routing Assignment:**
- **Primary:** CFO — Financial authority
- **Secondary:** Department Head — Budget owner
- **Tertiary:** CEO — Escalation if >$50K

**Priority Level:** 🟠 HIGH (24 hour review)

**Spending Thresholds:**
| Amount | Who Approves | Timeline |
|--------|-------------|----------|
| <$1K | Department Head | Same day |
| $1K-$50K | CFO | 24 hours |
| >$50K | CEO + CFO | 48 hours |
| >$100K | Board | 1 week |

**Process:**
1. Navi extracts financial info
2. Determine spending threshold
3. Route to appropriate approver
4. Generate action items
5. Archive to: `D:\04_PROJECTS\Finance\`

**Action Items Generated:**
- [ ] CFO: Financial review & approval
- [ ] Dept Head: Budget owner sign-off
- [ ] CEO: Escalation if >$50K
- [ ] Finance: Process approved expense
- [ ] Accounting: Record transaction

**Example:**
```
File: equipment_purchase_$8000.pdf
↓
CFO: Approve $8K expense (24 hrs)
↓
IT Dept: Procure equipment
↓
Accounting: Record & track
```

---

### 5️⃣ LEGAL & CONTRACT DOCUMENTS

**What It Looks Like:**
- Contracts
- Agreements
- Legal notices
- Compliance documents
- Terms of service
- NDAs

**Routing Assignment:**
- **Primary:** CLO — Legal review
- **Secondary:** CFO — Financial implications
- **Tertiary:** CEO — Final approval

**Priority Level:** 🟠 HIGH (48-72 hour review)

**Process:**
1. Navi identifies legal document
2. Routes to CLO for legal review
3. CFO assesses financial impact
4. Generate recommendations
5. CEO final approval if needed
6. Archive to: `D:\04_PROJECTS\Legal\`

**Action Items Generated:**
- [ ] CLO: Legal review & risk assessment
- [ ] CFO: Financial terms review
- [ ] CLO: Recommend approve/reject/negotiate
- [ ] CEO: Final approval (if >$50K)
- [ ] CLO: Negotiate or sign

**Example:**
```
File: vendor_agreement.pdf
↓
CLO: Legal risk assessment
↓
CFO: Financial terms OK?
↓
CEO: Final sign-off needed
↓
CLO: Execute agreement
```

---

### 6️⃣ HUMAN RESOURCES & PERSONNEL

**What It Looks Like:**
- Employee documents
- Hiring requests
- Leave requests
- Performance reviews
- Team updates
- Org changes

**Routing Assignment:**
- **Primary:** Secretary (Lyra) — Admin processing
- **Secondary:** CTO or Dept Head — Manager
- **Tertiary:** CEO — Final approval if major

**Priority Level:** 🟡 MEDIUM (24-48 hour review)

**Process:**
1. Navi identifies HR document
2. Routes to Lyra for processing
3. Manager reviews if needed
4. CEO approval if major change
5. Generate action items
6. Archive to: `D:\04_PROJECTS\Personnel\`

**Action Items Generated:**
- [ ] Lyra: Process HR document
- [ ] Manager: Review & approve
- [ ] CEO: Approval if major change
- [ ] HR: File & record change
- [ ] Team: Notify if needed

**Example:**
```
File: hiring_request_engineer.md
↓
Lyra: Process hiring request
↓
CTO (Bernard): Review role & budget
↓
CEO: Final approval if full-time hire
↓
HR: Post position
```

---

### 7️⃣ OPERATIONS & PROCESS DOCUMENTS

**What It Looks Like:**
- Process improvement proposals
- Operational changes
- Workflow documentation
- SOP updates
- Efficiency improvements
- Resource requests

**Routing Assignment:**
- **Primary:** COO — Operations authority
- **Secondary:** Affected Department Head
- **Tertiary:** CFO — Budget impact

**Priority Level:** 🟡 MEDIUM (48 hour review)

**Process:**
1. Navi identifies operational document
2. Routes to COO for review
3. Affected team input
4. CFO assesses budget impact
5. Generate recommendations
6. Archive to: `D:\04_PROJECTS\Operations\`

**Action Items Generated:**
- [ ] COO: Operational feasibility review
- [ ] Dept Head: Team impact assessment
- [ ] CFO: Budget impact analysis
- [ ] COO: Approve/reject/modify
- [ ] Implementation: Begin if approved

---

### 8️⃣ MARKETING & COMMUNICATIONS

**What It Looks Like:**
- Campaign proposals
- Marketing plans
- Brand guidelines
- Social media content
- PR materials
- Communications strategy

**Routing Assignment:**
- **Primary:** CMO — Marketing authority
- **Secondary:** Secretary (Lyra) — Scheduling/comms
- **Tertiary:** CEO — Strategic alignment

**Priority Level:** 🟡 MEDIUM (24-48 hour review)

**Process:**
1. Navi identifies marketing document
2. Routes to CMO for strategy review
3. Brand alignment check
4. CEO approval if major campaign
5. Generate action items
6. Archive to: `D:\04_PROJECTS\Marketing\`

**Action Items Generated:**
- [ ] CMO: Campaign review & approval
- [ ] CMO: Brand alignment check
- [ ] CEO: Strategic approval if major
- [ ] Marketing Team: Execute campaign
- [ ] Comms: Distribute materials

---

### 9️⃣ SPAM & REJECTED ITEMS

**What It Looks Like:**
- Unsolicited email offers
- Junk mail
- Duplicate files
- Obsolete documents
- Obvious spam

**Routing Assignment:**
- **None** — Auto-rejected by Navi

**Priority Level:** ⚫ NONE

**Process:**
1. Navi identifies spam
2. Auto-moves to Rejected folder
3. No processing required
4. Archive to: `D:\04_PROJECTS\Rejected\`

**Action Items Generated:**
- ✅ Delete/reject (COMPLETED)

**Example:**
```
File: unsolicited_offer_from_unknown@spam.com
↓
Navi: SPAM detected
↓
Auto-reject & archive
↓
No further action
```

---

## ROUTING RULES ENGINE

### Decision Tree for Navi

```
📥 File received
    ↓
🔍 Scan for spam? 
    ├─ YES → Reject & archive
    └─ NO → Continue
    ↓
🔎 Classify by type:
    ├─ Client Communication → CTO + Lyra
    ├─ Technical Document → CTO + COO
    ├─ Executive/Strategic → CEO + COS
    ├─ Budget/Finance → CFO
    ├─ Legal/Contract → CLO + CFO
    ├─ HR/Personnel → Lyra + Manager
    ├─ Operations → COO
    ├─ Marketing → CMO
    └─ Other → CEO for routing
    ↓
⚡ Determine priority:
    ├─ Executive items → URGENT (4 hours)
    ├─ Financial >$50K → HIGH (24 hours)
    ├─ Client communication → HIGH (24-48 hrs)
    ├─ Technical/Legal → MEDIUM (48-72 hrs)
    └─ Operational → MEDIUM (48-72 hrs)
    ↓
📋 Generate action items:
    ├─ Primary reviewer
    ├─ Secondary reviewer
    ├─ Decision/approval needed
    └─ Timeline
    ↓
📤 Route to agents
    ↓
💾 Archive with metadata
    ↓
✅ Notify assigned agents
```

---

## SPECIAL ROUTING SCENARIOS

### Scenario 1: Multi-Department Routing
**Example:** Strategic partnership proposal ($100K)

```
File: partnership_proposal.md ($100K deal)
    ↓
Primary Route: CEO (strategy decision)
    ├─ CTO (Bernard): Technical fit assessment
    ├─ CFO: Financial terms review ($100K threshold)
    ├─ CLO: Contract & legal review
    └─ CMO: Marketing/brand alignment
    ↓
Sequence: CTO → CFO → CLO → CMO → CEO decision
Timeline: 5-7 days
Archive: D:\04_PROJECTS\Partnerships\ & D:\04_PROJECTS\Executive\
```

### Scenario 2: Blocked Escalation
**Example:** Budget request for $30K but no CFO response after 24 hrs

```
File: equipment_purchase_$30K.pdf
    ↓
Route to CFO (24 hour SLA)
    ↓
At 24 hours: No response?
    ↓
Escalate to CEO (budget authority)
    ↓
Escalation logged in compliance database
    ↓
Follow-up required from CEO within 2 hours
```

### Scenario 3: Urgent Executive Item
**Example:** CEO needs immediate decision

```
File: crisis_response_plan.md (URGENT)
    ↓
PRIORITY: URGENT
    ↓
Route to CEO immediately
    ↓
Response SLA: 2 hours maximum
    ↓
COS: Coordinate immediate notifications
    ↓
All departments: Standby for updates
    ↓
AIR: Log escalation for compliance
```

---

## RESPONSE TIME SLA

| Priority | Target Response | Max Response | Escalation After |
|----------|-----------------|--------------|------------------|
| URGENT 🔴 | 2 hours | 4 hours | 2 hours |
| HIGH 🟠 | 4 hours | 24 hours | 24 hours |
| MEDIUM 🟡 | 8 hours | 48 hours | 48 hours |
| STANDARD ⚪ | 24 hours | 72 hours | 72 hours |

---

## ARCHIVE & COMPLIANCE

### Archive Location Reference

| Document Type | Archive Location | Retention |
|---|---|---|
| Client Communications | `D:\04_PROJECTS\ClientPartnerships\` | 3 years |
| Technical Docs | `D:\04_PROJECTS\TechnicalDocs\` | 5 years |
| Executive/Strategic | `D:\04_PROJECTS\Executive\` | 7 years |
| Finance/Budget | `D:\04_PROJECTS\Finance\` | 7 years |
| Legal/Contracts | `D:\04_PROJECTS\Legal\` | Permanent |
| HR/Personnel | `D:\04_PROJECTS\Personnel\` | 5 years |
| Operations | `D:\04_PROJECTS\Operations\` | 3 years |
| Marketing | `D:\04_PROJECTS\Marketing\` | 2 years |
| Rejected/Spam | `D:\04_PROJECTS\Rejected\` | 30 days |

---

## ROUTING RULES VERSION

**Routing Rules:** VBoarder Inc. v2.0  
**Effective Date:** December 9, 2025  
**Last Updated:** December 9, 2025  
**Next Review:** March 9, 2026  
**Maintained By:** AIR + Navi Thompson  

---

*All incoming files are routed according to these rules. Exceptions require CEO approval and must be documented for compliance. For questions about routing, contact the Secretary (Lyra) or AIR.*
