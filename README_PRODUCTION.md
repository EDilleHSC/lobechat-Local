# VBoarder System - Production Ready

## Status: 🟢 PRODUCTION READY (v1.0-pre-production-clean)

**System cleaned and tagged as of:** December 14, 2025

All test artifacts safely archived in `ARCHIVE_TEST/`. This is your rollback point.

## Operating Rules (Non-Negotiable)

### Inbox Rules
- **Intentional only**: One file = one purpose
- **No bulk drops**: Use COLLECTION for bulk intake
- **No parking**: Files in Inbox must be processed
- **Maximum 1-3 files per run** during initial production

### COLLECTION Rules
- **Bulk intake buffer**: For messy, non-urgent files
- **Manual promotion only**: Nothing moves to Inbox automatically
- **Review required**: Every file must be examined before promotion
- **Purposeful movement**: Files need destination agent and reason

### AIR Rules
- **Advisory only**: Observes, warns, summarizes
- **Never moves files**: No routing decisions
- **Never deletes**: No cleanup actions
- **Never promotes**: No COLLECTION → Inbox movement

### Trash Rules
- **TRASH_CANDIDATE ≠ delete**: Waiting to be deleted
- **Manual deletion only**: Human judgment required
- **Logged and delayed**: 7+ day waiting period
- **Auditable**: Full deletion history

## First Production Runs

### Real Run #1 - Inbox (Small Test)
1. Put 1-3 real files in `NAVI/inbox/`
2. Click `Process_Inbox.bat`
3. Observe ACTIVE/WAITING placement
4. Read Presenter summary
5. **Wait 10 minutes** - build trust

### Real Run #2 - Bulk Intake
1. Drop bulk files in `COLLECTION/INCOMING/`
2. Run `Process_Collection.bat`
3. Open `📦 COLLECTION Overview` desktop shortcut
4. **Do NOT promote yet** - just observe

## System Health Verification

After cleanup, verified:
- ✅ inbox_count = 0
- ✅ active_count = 0
- ✅ waiting_count = 0
- ✅ done_count = 0
- ✅ All COLLECTION directories exist and empty

## What NOT To Do (For First Week)
- ❌ Running process twice "just to check"
- ❌ Mixing test + real files
- ❌ Auto-promoting from COLLECTION
- ❌ Adding new AI logic
- ❌ "Fixing" things that aren't broken

## Emergency Rollback
If needed: `git checkout v1.0-pre-production-clean`

## Architecture Summary
- **Inbox**: Deterministic, intentional processing
- **COLLECTION**: Safe bulk intake buffer
- **AIR**: Advisory AI traffic control
- **Presenter**: Human-readable summaries
- **Snapshots**: Complete audit trail
- **Git**: Version control and rollback safety

## Trust Building
This system is about **calm, deterministic operations**, not cleverness. Every file represents real intent. Build trust through small, observed runs.