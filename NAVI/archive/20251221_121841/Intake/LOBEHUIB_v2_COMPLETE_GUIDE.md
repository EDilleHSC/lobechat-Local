# 📚 LOBEHUIB v2.0 COMPLETE GUIDE
## File Upload, RAG, Chain of Thought, & Knowledge Base Linking

---

# SECTION 1: FILE UPLOAD (Everything You Need to Know)

## What is File Upload?

**File Upload allows you to:**
- Drop files directly into chat
- Automatic processing and indexing
- Extract information from files
- Create searchable knowledge bases
- Reference files in conversations

---

## Supported File Types

| File Type | Format | Max Size | Processing |
|-----------|--------|----------|-----------|
| **Documents** | .pdf, .docx, .xlsx, .txt, .md | 50MB | Text extraction + OCR |
| **Images** | .png, .jpg, .jpeg, .gif, .webp | 50MB | Vision recognition |
| **Audio** | .mp3, .wav, .m4a, .aac | 50MB | Transcription |
| **Video** | .mp4, .webm, .mov | 50MB | Transcription + analysis |
| **Archives** | .zip, .tar, .gz | 50MB | Batch extraction |

---

## How to Upload Files

### Method 1: Drag and Drop (Easiest)

```
1. Open any chat with Navi
2. Drag file(s) from your computer
3. Drop into chat window
4. File appears in chat
5. Navi processes automatically
```

**Files processed in real-time!**

---

### Method 2: Click Upload Button

```
1. Open chat
2. Look for upload icon (📎 or ⬆️)
3. Click to select file
4. Choose file from computer
5. File uploads and processes
```

---

### Method 3: Direct Knowledge Base Upload

```
1. Go to Knowledge Base (left sidebar)
2. Click on specific KB
3. Click "Upload" or "+"
4. Select file(s)
5. File indexed to KB
6. Available for all agents
```

---

## What Happens When You Upload?

```
File Dropped
    ↓
Virus Scan (security check)
    ↓
Type Detection (what kind of file?)
    ↓
Content Extraction (get text/data)
    ↓
Chunking (break into pieces)
    ↓
Embedding (convert to vectors)
    ↓
Storage (PostgreSQL + pgvector)
    ↓
Indexing (searchable)
    ↓
Ready to Query
```

**Total time: Usually 1-5 minutes depending on file size**

---

## File Upload Best Practices

### ✅ DO:
- Upload one file at a time for clarity
- Use clear, descriptive filenames
- Organize files before uploading
- Upload to Knowledge Base (not just chat)
- Check file integrity before upload

### ❌ DON'T:
- Upload 50 files at once (overwhelming)
- Use special characters in filenames
- Upload corrupted or empty files
- Upload same file multiple times
- Expect instant results on huge files

---

# SECTION 2: RAG (Retrieval-Augmented Generation)

## What is RAG?

**RAG = Retrieval-Augmented Generation**

```
Without RAG:
User: "What's in document X?"
AI: "I don't know, I haven't read it"

With RAG:
User: "What's in document X?"
AI: 
1. Searches knowledge base
2. Finds matching documents
3. Retrieves relevant sections
4. Generates answer from actual content
5. Returns: "According to document X..."
```

**RAG makes AI reference your actual documents!**

---

## How RAG Works (Step by Step)

```
┌──────────────────────────────────────────┐
│         RAG PIPELINE                     │
├──────────────────────────────────────────┤
│                                          │
│ 1. USER ASKS QUESTION                   │
│    "What are spending thresholds?"      │
│                                          │
│ 2. CONVERT TO VECTOR                    │
│    Question → Math representation        │
│    Using embedding model (nomic-embed)   │
│                                          │
│ 3. VECTOR SEARCH                        │
│    Find similar vectors in KB            │
│    Using pgvector in PostgreSQL          │
│    Returns top 5 matches                 │
│                                          │
│ 4. RETRIEVE DOCUMENTS                   │
│    Get actual text from matches          │
│    Context window: 3000 tokens           │
│                                          │
│ 5. AUGMENT PROMPT                       │
│    Add retrieved text to prompt          │
│    Combined with system instructions     │
│                                          │
│ 6. GENERATE ANSWER                      │
│    AI reads documents                    │
│    Generates response from actual data   │
│    Cites sources                         │
│                                          │
│ 7. RETURN TO USER                       │
│    "According to [Document], ..."       │
│                                          │
└──────────────────────────────────────────┘
```

---

## RAG Configuration

### In Navi's Settings (v2.0):

```
Knowledge Base Settings:
├─ Enable RAG: ☑️ (MUST be ON)
├─ Knowledge Base: VBoarder_Company_Context
├─ Search Type: Vector (semantic search)
├─ Embedding Model: nomic-embed-text
├─ Context Window: 3000 tokens
├─ Top K Results: 5 documents
└─ Similarity Threshold: 0.7
```

---

## RAG Best Practices

### For Better Results:

```
1. ORGANIZE DOCUMENTS
   - Clear titles
   - Logical structure
   - Consistent formatting

2. USE GOOD CONTENT
   - Complete information
   - No duplicates
   - High quality writing

3. STRUCTURE CHUNKS
   - 500-1000 words per chunk
   - Clear section breaks
   - Good headings

4. OPTIMIZE QUERIES
   - Specific questions
   - Use document keywords
   - Include context

5. MONITOR RESULTS
   - Check if answers are accurate
   - Verify citations
   - Adjust if needed
```

---

# SECTION 3: CHAIN OF THOUGHT (CoT)

## What is Chain of Thought?

**Chain of Thought = Show Your Reasoning**

```
Without CoT:
Question: "What should we do?"
Answer: "Route to CTO"

With CoT:
Question: "What should we do?"
Answer: 
"Let me think through this:
1. File type is technical
2. Technical files go to CTO
3. CTO handles architecture
4. Therefore: Route to CTO"
```

**CoT shows the thinking process!**

---

## How Chain of Thought Works

### In v2.0 with DeepSeek R1:

```
INPUT
  ↓
THINKING PHASE
"Let me analyze this..."
"I see these options..."
"The best approach is..."
  ↓
REASONING TRANSPARENCY
Shows step-by-step logic
  ↓
OUTPUT
Clear answer with reasoning
  ↓
HIDDEN THINKING (Optional)
User sees final answer
Internal reasoning tracked
```

---

## Enabling Chain of Thought

### Option 1: Use DeepSeek R1 Model

```
Settings → Model Selection
Choose: DeepSeek R1
Automatically enables CoT
```

**Best reasoning available!**

---

### Option 2: Prompt Engineering

Add to Navi's system prompt:

```markdown
## CHAIN OF THOUGHT REASONING

Before responding, think through:
1. What is the question asking?
2. What information do I have?
3. What are the options?
4. Which is best?
5. Why is it best?

Then explain your reasoning step-by-step.
```

---

## Example: CoT in Action

### Scenario: File Routing Decision

```
USER: "I have a $60K partnership contract. Where should it go?"

NAVI'S CHAIN OF THOUGHT:

Step 1: Identify document type
"This is a contract (legal document)"

Step 2: Check policies
"Contracts require legal review (CLO)"
"$60K exceeds $50K threshold"

Step 3: Determine routing
"Legal review mandatory (CLO)"
"Financial review needed (CFO)"
"CEO approval required (>$50K)"

Step 4: Prioritize
"Primary: CLO (legal expertise)"
"Secondary: CFO (financial terms)"
"Final: CEO (strategic approval)"

ANSWER:
"Route to: CLO → CFO → CEO

Reasoning:
1. Contract requires legal review (company policy)
2. Amount ($60K) exceeds CEO threshold
3. Financial terms need CFO assessment
4. Strategic partnership needs CEO approval
Timeline: 1 week for full review"
```

---

## Chain of Thought Best Practices

### ✅ DO:
- Use for complex decisions
- Show reasoning steps
- Cite sources
- Explain trade-offs
- Document reasoning

### ❌ DON'T:
- Use for simple yes/no
- Over-explain obvious things
- Hide reasoning
- Contradict yourself
- Change logic mid-response

---

# SECTION 4: KNOWLEDGE BASE LINKING TO AGENTS

## This is the Most Important Part! 🔗

---

## Understanding Knowledge Base Architecture in v2.0

```
GLOBAL KNOWLEDGE BASE
│
├─ VBoarder_Company_Context
│  ├─ Document 1
│  ├─ Document 2
│  └─ Document 3
│
AGENTS (Access KB)
│
├─ Navi ← Linked to VBoarder_Company_Context
├─ CTO ← Can be linked separately
├─ CEO ← Can be linked separately
└─ Other Agents
```

**Key: Each agent can have different KB linked!**

---

## How to Link Knowledge Base to Agent

### Step-by-Step for Navi:

#### STEP 1: Open Agent Settings

```
1. Go to Agents (left sidebar)
2. Find "Navi Thompson"
3. Click settings icon (⚙️)
4. Agent settings panel opens
```

---

#### STEP 2: Find Knowledge Base Section

**In v2.0, look for:**

```
Agent Settings Tabs:
├─ General
├─ Model Settings
├─ System Prompt
├─ Plugins & Tools
├─ Knowledge Base ← THIS ONE
└─ Advanced
```

**Click: Knowledge Base tab**

---

#### STEP 3: Enable Knowledge Base

**You should see:**

```
Knowledge Base Settings
│
├─ Enable Knowledge Base: ☐ (checkbox)
│  Click to enable: ☑️
│
├─ Select Knowledge Base: [Dropdown ▼]
│  Select: VBoarder_Company_Context
│
├─ RAG Settings:
│  ├─ Enable RAG: ☑️
│  ├─ Search Type: Vector
│  ├─ Top K Results: 5
│  └─ Similarity Threshold: 0.7
│
└─ [Save Button]
```

---

#### STEP 4: Select the Knowledge Base

**Click dropdown:**

```
Select Knowledge Base ▼

Options:
├─ None (no KB)
├─ VBoarder_Company_Context ← SELECT THIS
├─ Other KBs (if any)
└─ Create New KB
```

**Choose: VBoarder_Company_Context**

---

#### STEP 5: Enable RAG (Retrieval-Augmented Generation)

**Make sure enabled:**

```
☑️ Enable RAG for this agent
   (Must be checked for KB to work)

RAG Settings:
├─ Search Type: Vector (best)
├─ Similarity Threshold: 0.7 (default)
├─ Top K Results: 5 (return 5 docs)
└─ Context Window: 3000 tokens
```

---

#### STEP 6: Save Settings

```
Click [Save] button

You should see:
✅ Settings saved
or
✅ Knowledge base linked successfully
```

---

#### STEP 7: Verify Connection

**Test if linked:**

```
Go to Navi's chat and ask:
"What are the spending approval thresholds?"

She should respond:
"According to our Knowledge Base
[Source: 01_VBoarder_Company_Policies.md]:
- <$1K: Department head
- $1K-$50K: CFO (24 hours)
- $50K-$100K: CEO + CFO (48 hours)
- >$100K: Board review (1 week)"

✅ If she cites sources = LINKED!
❌ If no citation = Not linked yet
```

---

## Complete Linking Checklist

- [ ] Opened Agent Settings for Navi
- [ ] Found Knowledge Base tab
- [ ] Enabled Knowledge Base checkbox
- [ ] Selected VBoarder_Company_Context from dropdown
- [ ] Enabled RAG (checkbox)
- [ ] Verified settings:
  - [ ] Search Type: Vector
  - [ ] Top K Results: 5
  - [ ] Similarity Threshold: 0.7
- [ ] Clicked Save
- [ ] Received confirmation message
- [ ] Tested with KB query
- [ ] Agent cited sources in response
- [ ] All working! ✅

---

# SECTION 5: ADVANCED LINKING OPTIONS

## Linking Multiple Knowledge Bases

**In v2.0, you can:**

```
Agent 1 (Navi): VBoarder_Company_Context
Agent 2 (CTO): VBoarder_Technical_KB (different KB)
Agent 3 (CEO): VBoarder_Executive_KB (different KB)

Each agent can have different knowledge!
```

---

## Creating Agent-Specific Knowledge Bases

### If you want different KB per agent:

```
1. Create new KB for each agent
   ├─ VBoarder_Navi_KB
   ├─ VBoarder_CTO_KB
   └─ VBoarder_CEO_KB

2. Upload different docs to each

3. Link each KB to specific agent

4. Each agent has specialized knowledge
```

---

## KB Linking Best Practices

### ✅ DO:
- Link relevant KB to each agent
- Use same KB for coordinated agents
- Test linking after setup
- Monitor citation accuracy
- Update KB when policies change

### ❌ DON'T:
- Link unrelated KBs
- Overload KB with irrelevant docs
- Forget to enable RAG
- Ignore citation errors
- Leave KB outdated

---

# SECTION 6: TROUBLESHOOTING

## Problem 1: Agent Not Accessing Knowledge Base

### Symptoms:
```
- Agent gives wrong answers
- Doesn't cite sources
- Makes up information
- Ignores KB documents
```

### Solutions:

```
STEP 1: Check if KB is linked
├─ Agent Settings → Knowledge Base tab
├─ Is checkbox enabled? ☑️
└─ Is KB selected in dropdown?

STEP 2: Check if RAG is enabled
├─ Verify: Enable RAG ☑️
└─ Check: Search Type: Vector

STEP 3: Verify KB has documents
├─ Go to Knowledge Base
├─ Click VBoarder_Company_Context
└─ Are 5 documents showing? ✅

STEP 4: Re-index KB
├─ Settings → Knowledge Base
├─ Force Re-index (if available)
└─ Wait 2-5 minutes

STEP 5: Test again
├─ Ask specific question
└─ Check for sources cited
```

---

## Problem 2: KB Documents Not Indexed

### Symptoms:
```
- Files uploaded but don't appear
- Search returns no results
- Indexing takes too long
```

### Solutions:

```
QUICK FIX:
1. Delete KB
2. Recreate VBoarder_Company_Context
3. Re-upload 5 files
4. Wait for indexing (2-5 min)
5. Verify all files show

DETAILED FIX:
1. Check PostgreSQL running
   Command: psql -U postgres -c "SELECT 1;"
   
2. Check pgvector installed
   Command: psql -U postgres -c "CREATE EXTENSION pgvector;"
   
3. Restart LobeChat
   Stop and start service
   
4. Re-index KB
   Settings → Knowledge Base → Force Re-index
   
5. Wait for completion
   Should show "Indexing complete"
```

---

## Problem 3: Slow KB Searches

### Symptoms:
```
- Searching KB takes 10+ seconds
- RAG queries timeout
- Agent responses delayed
```

### Solutions:

```
PERFORMANCE OPTIMIZATION:
1. Reduce Top K Results
   From: 5 → 3
   Fewer results = faster search

2. Increase Similarity Threshold
   From: 0.7 → 0.8
   More strict = fewer comparisons

3. Optimize PostgreSQL
   Command: VACUUM ANALYZE knowledge_base;

4. Clear cache
   Browser: Ctrl+Shift+Delete
   LobeChat: Settings → Clear Cache

5. Restart all services
   Stop/start: PostgreSQL, Ollama, LobeChat
```

---

# SECTION 7: COMPLETE WORKFLOW

## End-to-End: Upload, Link, Query

### 1. UPLOAD FILES

```
Knowledge Base → VBoarder_Company_Context
↓
Click "Upload"
↓
Select 5 files
↓
Wait for indexing (3-5 min)
↓
✅ Files indexed
```

---

### 2. LINK TO AGENT

```
Agents → Navi Thompson → Settings
↓
Knowledge Base tab
↓
Enable KB: ☑️
↓
Select: VBoarder_Company_Context
↓
Enable RAG: ☑️
↓
Save
↓
✅ KB linked
```

---

### 3. TEST QUERY

```
Open Navi's chat
↓
Ask: "What are the spending thresholds?"
↓
Navi searches KB
↓
RAG retrieves 5 matching documents
↓
Navi reads documents
↓
Generates answer from actual content
↓
Cites: [Source: 01_VBoarder_Company_Policies.md]
↓
✅ Works!
```

---

### 4. USE IN PRODUCTION

```
Files come in → Navi processes
↓
Uses KB for policies
↓
References KB for routing
↓
Cites company standards
↓
Routes correctly every time
↓
✅ System operational
```

---

# SECTION 8: SUMMARY TABLE

| Feature | What It Does | When to Use |
|---------|------------|-----------|
| **File Upload** | Add files to system | When you have documents |
| **Knowledge Base** | Store & index docs | Persistent knowledge |
| **RAG** | Search & retrieve docs | Answer from actual files |
| **Chain of Thought** | Show reasoning | Complex decisions |
| **KB Linking** | Connect KB to agent | Agent uses KB |

---

# SECTION 9: QUICK REFERENCE

## File Upload
```
Drag & drop OR click upload button
Files automatically processed
```

## RAG
```
Searches knowledge base
Retrieves matching documents
Generates answer from actual content
```

## Chain of Thought
```
Shows step-by-step reasoning
Explains decision logic
Makes thinking transparent
```

## KB Linking
```
Agent Settings → Knowledge Base tab
Enable KB + RAG
Select VBoarder_Company_Context
Save
Test with query
```

---

# FINAL CHECKLIST

After v2.0 upgrade and setup:

- [ ] Upgrade to v2.0.0-next successful
- [ ] All services running (PostgreSQL, Ollama, LobeChat)
- [ ] Knowledge Base created (VBoarder_Company_Context)
- [ ] 5 files uploaded and indexed
- [ ] Navi agent created
- [ ] KB linked to Navi
- [ ] RAG enabled
- [ ] Test query works
- [ ] Sources cited in responses
- [ ] File upload working
- [ ] Chain of Thought working (if using DeepSeek R1)
- [ ] System fully operational

**All checked = Ready for production!** ✅

---

*Complete guide to v2.0: File upload, RAG, Chain of Thought, and Knowledge Base linking. You now know everything!*
