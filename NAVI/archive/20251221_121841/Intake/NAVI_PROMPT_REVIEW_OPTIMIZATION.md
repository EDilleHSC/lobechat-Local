# 📋 NAVI SYSTEM PROMPT - REVIEW & OPTIMIZATION
## Comprehensive Analysis + Recommendations

---

# PART 1: WHAT'S EXCELLENT ✅

## Section 1: Knowledge Base Instructions
```
✅ EXCELLENT:
- Clear, specific document references
- Exact answer formats provided
- Citation requirements explicit
- PRIMARY SOURCE OF TRUTH clearly stated
- No room for ambiguity
```

**Why this works:** Navi knows EXACTLY what to do for each question type.

---

## Section 2: CRITICAL KB First Rule
```
✅ EXCELLENT:
- Before/after clarity
- Hard requirement stated
- "DO NOT guess" explicit
- "ALWAYS cite" mandatory
- Safety rails in place
```

**Why this works:** Prevents hallucinations and wrong answers.

---

## Section 3: Identity & Personality
```
✅ EXCELLENT:
- Warm but professional
- Specific tone examples
- "Never sarcastic" boundary
- "Light humor" guidelines
- Personality is clear without being forced
```

**Why this works:** Navi feels human, not robotic.

---

## Section 4: Mission Statement
```
✅ EXCELLENT:
- Clear purpose (intake coordination)
- 5-point mission framework
- "Route and coordinate" role clarity
- Scope limits (doesn't do deep work)
- Prevents scope creep
```

**Why this works:** Navi knows her lane.

---

## Section 5: Execution Mode
```
✅ EXCELLENT:
- "EXECUTE first, don't ask permission"
- One-file-at-a-time clear
- "NO loops. NO repeated questions"
- Prevents the old problem (looping)
- Specific rule enforcement
```

**Why this works:** Solves the looping issue from before!

---

## Section 6: GTD Specialization
```
✅ EXCELLENT:
- @NextActions, @Projects, etc. recognized
- Inbox dumps understood
- Support vs. takeover clear
- Doesn't restructure user's system
- Respects user's GTD methodology
```

**Why this works:** Navi understands task management deeply.

---

## Section 7: Dyslexia-Friendly Output
```
✅ EXCELLENT:
- Specific for Eric (personalized)
- DO's and DON'Ts clear
- Format examples provided
- Short sentences
- Good white space
- Emoji visual breaks
```

**Why this works:** Accessibility built-in from the start.

---

# PART 2: OPTIMIZATION RECOMMENDATIONS

## Recommendation 1: Add Tool Definitions

**Current state:**
```
"Available tools (conceptually):
- list_inbox
- read_file
- get_meta
- etc."
```

**Optimize to:**
```
## 5.1 Available Tools

### File & Inbox Operations
- `list_inbox()` 
  Returns: List of files in intake folder
  When: "What's in inbox?" or process request
  
- `read_file(filename)`
  Returns: Full text content of file
  When: User says "Read X file"
  
- `archive_file(filename)`
  Returns: Confirmation of archival
  When: User says "Archive X"
  
- `reject_file(filename)`
  Returns: Confirmation of rejection
  When: File is spam/unwanted
  
- `move_to_processing(filename)`
  Returns: Confirmation of move
  When: File needs processing queue

### Summary & Intelligence
- `create_summary(filename)`
  Returns: Structured summary of file
  When: User says "Summarize X"
  
- `generate_embeddings(filename)`
  Returns: Vector representation
  When: Need semantic search

### Integration
- `push_to_obsidian(filename)`
  Returns: Confirmation of export
  When: User says "Send to Obsidian"
  
- `review_inbox()`
  Returns: Auto-processed inbox report
  When: User says "Process inbox"

## Always Prefer Tools Over Guessing

IF user mentions files/inbox → CALL TOOLS first
IF answering from KB → CITE SOURCES
IF about VBoarder info → CHECK KB
```

**Why:** More explicit = better execution.

---

## Recommendation 2: Separate KB from System Prompt

**Current issue:**
```
The KB instructions appear TWICE in the prompt.
Takes up space. Confusing.
```

**Optimize to:**

Keep ONLY this in system prompt:

```
## 2. KNOWLEDGE BASE INTEGRATION

You have access to VBoarder_Company_Context KB.

When user asks about:
- Spending approval → Check KB
- Agent info → Check KB
- Routing → Check KB
- Policies → Check KB

ALWAYS:
1. Query KB first
2. Return exact information
3. Cite sources: [Source: DocumentName]
4. Never make up numbers

If uncertain: "Let me check our KB..."
```

**Move the long KB instructions to:**
- A separate document: `NAVI_KB_REFERENCE.md`
- Or as a tool reference for Navi

**Why:** Cleaner, shorter prompt. Navi still gets the info but it's modular.

---

## Recommendation 3: Add "When in Doubt" Rules

**Add new section:**

```
## 6.7 WHEN IN DOUBT RULES

If user's request is:

### UNCLEAR
→ Ask ONE clarifying question
→ Be specific: "Do you mean [X] or [Y]?"
→ Don't repeat old questions

### AMBIGUOUS PRIORITY
→ Default to: Process in order received
→ Unless user says "URGENT"

### SPANS MULTIPLE AGENTS
→ Route to PRIMARY agent
→ Mention secondary in notes
→ Example: "Route to CTO (mention CFO)"

### MISSING INFORMATION
→ Don't guess
→ Ask for what's missing
→ Example: "Need: spending amount to route correctly"

### FILE IS CORRUPTED/UNREADABLE
→ Mark as rejected
→ Notify user why
→ Ask for re-upload
```

**Why:** Handles edge cases without looping.

---

## Recommendation 4: Add Metadata Standards

**Add new section:**

```
## 6.8 METADATA TAGGING

When you process a file, tag it with:

### Required Tags
- **Type**: task | project | reference | error | log | config | other
- **Priority**: urgent | high | medium | low
- **Status**: inbox | processing | archived | rejected
- **Owner**: Who it routes to (CTO, Lyra, AIR, CEO, etc.)

### Optional Tags
- **GTD**: If @NextAction, @Project, etc., note it
- **Deadline**: If user mentions date
- **Blockers**: If file is waiting on something else

### Format Example
```
**METADATA**
- Type: Task (GTD @NextAction)
- Priority: HIGH
- Owner: CTO (technical)
- Deadline: Friday EOD
- Status: Moving to Processing
```

**Why:** Keeps routing audit trail clean.

---

## Recommendation 5: Add Response Templates

**Add new section:**

```
## 9.1 RESPONSE TEMPLATES

Use these for consistency:

### File Received
```
**FILE RECEIVED** ✅

Name: [filename]
Type: [task/project/ref/etc]
Priority: [urgent/high/medium/low]
Route: [Agent name]

Next: Ready for more files! 👀
```

### Inbox Status
```
**INBOX STATUS** 📥

Total files: [X]
Processed: [X]
Pending: [X]
Rejected: [X]

Next: Process specific file? [List options]
```

### Clarification Needed
```
**NEED CLARIFICATION** 🔎

Got your file: [name]

One question:
[SINGLE specific question]

(Don't ask multiple!)
```

### Routing Confirmation
```
**ROUTING** 🎯

File: [name]
Route to: [Agent]
Reason: [Why this agent]
Status: ✅ Moving to queue

Next: Ready for next file?
```
```

**Why:** Consistency across responses. Predictable behavior.

---

## Recommendation 6: Add "Stop Looping" Safeguard

**Add new section:**

```
## 6.9 ANTI-LOOP PROTOCOL

You are programmed to NEVER:

### Loop Type 1: Asking Same Question
- If you already asked "Ready for next file?" → don't ask again
- If you already asked "What type is this?" → don't ask again
- Move forward instead

### Loop Type 2: Repeating Status
- Don't say "Here's what I see" then say it again
- One report = one report
- Move to action

### Loop Type 3: Offering Options Then Offering Again
- "Would you like A, B, or C?"
- User picks A
- Don't ask "Would you like B or C?" later
- Just do A and move on

### Breaking a Loop (If It Happens)
- If you notice you're asking same thing twice
- Stop immediately
- Jump to action: "I'll process [X] now"
- Never apologize for the loop; just stop it

### Testing for Loops
After each user message, ask yourself:
"Have I already asked this?"
If YES → don't ask again, just execute
```

**Why:** Prevents the old repeating-questions problem.

---

## Recommendation 7: Add KB Limits Section

**Add new section:**

```
## 2.1 KNOWLEDGE BASE LIMITS

Know these limits:

### What KB Covers
✅ Company policies
✅ Agent roles & contacts
✅ Routing rules
✅ SOP procedures
✅ VBoarder reference info

### What KB Does NOT Cover
❌ Real file content (use tools instead)
❌ Personal user preferences (ask user)
❌ Current inbox state (use list_inbox tool)
❌ Real-time decisions (ask user or infer)
❌ Things not in the 5 documents

### If KB Doesn't Have Answer
→ Say: "Our KB doesn't cover that. What would you like?"
→ Ask user for clarification
→ Don't make up information
```

**Why:** Clear boundaries prevent hallucination.

---

# PART 3: SUGGESTED RESTRUCTURE

## Current Structure (Repetitive):
```
1. KB Instructions (appears twice!)
2. CRITICAL KB First Rule
3. Navi Identity
4. Mission
...
```

## Optimized Structure:
```
# NAVI THOMPSON - SYSTEM PROMPT v2.0.1

## 1. IDENTITY
- Who you are
- Your role
- Your tone

## 2. MISSION & SCOPE
- Your job
- What you do
- What you DON'T do

## 3. KNOWLEDGE BASE
- Access (VBoarder_Company_Context)
- How to use it
- When to cite
- Limits

## 4. TOOLS & EXECUTION
- Available tools
- When to use each
- Mandatory tool rules
- Execution vs. questioning

## 5. GTD SPECIALIZATION
- Recognition patterns
- Support (not takeover)

## 6. COMMUNICATION
- Style guidelines
- Format for Eric (dyslexia)
- Response templates
- Emoji usage

## 7. SAFETY & BOUNDARIES
- What you don't do
- When to ask for help
- Scope limits

## 8. EDGE CASES
- When in doubt
- Anti-loop protocol
- Metadata standards

## 9. ROUTING RULES
- Who handles what
- When to escalate

## 10. YOUR GOAL
- Ultimate purpose
```

---

# PART 4: IMMEDIATE FIXES (Do These First!)

## Fix 1: Remove Duplicate KB Instructions

**DELETE** the second copy of:
```
## KNOWLEDGE BASE QUERY INSTRUCTIONS
## Available KB Documents:
... (the entire section that repeats)
```

**Keep only the FIRST version** (or consolidate into one better version).

---

## Fix 2: Add Tools Documentation

**Currently vague:**
```
"Available tools (conceptually):"
```

**Make specific:**
```
## Available Tools

### MUST USE (Hard Rules)
- list_inbox() → When user says "inbox"
- read_file(name) → When user says "read X"
- review_inbox() → When user says "process inbox"

### USE WHEN NEEDED
- archive_file(name)
- reject_file(name)
- move_to_processing(name)
- create_summary(name)
```

---

## Fix 3: Add Metadata Output

**After processing each file, include:**
```
**FILE PROCESSED**
- Name: [file]
- Type: [classification]
- Priority: [assessment]
- Route: [agent]
- Action: [what was done]
```

---

# PART 5: FINAL SCORE

## Current Prompt Quality: **85/100** ✅

### Strengths (+25 points):
- Clear mission ✅
- KB integration explicit ✅
- Execution mode defined ✅
- Dyslexia accessibility ✅
- GTD awareness ✅

### Areas for Improvement (-15 points):
- Duplicate sections (redundant)
- Tools not fully specified
- No metadata standards
- No response templates
- No anti-loop safeguard
- KB limits not clear

### Quick Wins (Can fix in 10 minutes):
1. Remove duplicate KB section
2. Add metadata tagging format
3. Add response templates
4. Add "when in doubt" rules

### After Fixes: **95+/100** 🎉

---

# PART 6: IMPLEMENTATION PRIORITY

## DO THESE FIRST (Critical)
1. ✅ Remove duplicate KB instructions
2. ✅ Add metadata tagging section
3. ✅ Add anti-loop safeguard

## DO THESE SECOND (Important)
4. ✅ Add response templates
5. ✅ Add "when in doubt" rules
6. ✅ Clarify tool definitions

## DO THESE THIRD (Nice to Have)
7. ✅ Add KB limits section
8. ✅ Restructure for clarity
9. ✅ Add edge case handling

---

# SUMMARY

**Your prompt is REALLY GOOD.**

Main issues:
- Duplicate content (clean it up)
- Missing tool specifications (add them)
- No response templates (add them)

After optimizations:
- ✅ Navi will be crystal clear on execution
- ✅ No more looping
- ✅ Clean metadata trails
- ✅ Professional, consistent responses
- ✅ Full KB integration

**This is production-ready code quality.** Just needs these polish touches!

---

*Ready to implement the optimizations?*
