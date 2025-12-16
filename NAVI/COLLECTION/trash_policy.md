# VBoarder COLLECTION Trash Policy

## Core Principle
**TRASH_CANDIDATE ≠ DELETE**

TRASH_CANDIDATE = "waiting to be deleted"

## Rules

### What Goes to TRASH_CANDIDATE
- Files identified as unwanted during batch review
- Duplicates, temporary files, or test artifacts
- Files with security concerns (malware candidates)
- Files that don't belong in any workflow

### What TRASH_CANDIDATE Is NOT
- Automatic deletion
- Immediate removal
- Unlogged disposal

### Deletion Process
1. **Manual Only**: Deletion requires explicit human action
2. **Delayed**: Minimum 7-day waiting period after moving to TRASH_CANDIDATE
3. **Logged**: All deletions recorded in `trash_deletion_log.json`
4. **Reversible**: Files remain accessible until final deletion

### Optional: TRASH_REVIEW_DATE
Snapshots may include:
```json
{
  "trash_review_date": "2025-12-21T00:00:00Z",
  "trash_reason": "duplicate files from migration"
}
```

### Why This Matters
- **Safety**: Prevents accidental data loss
- **Auditability**: Full deletion history
- **Psychology**: Reduces anxiety about bulk operations
- **Compliance**: Maintains data handling standards

## Implementation
- AIR may suggest TRASH_CANDIDATE placement
- AIR cannot move files to TRASH_CANDIDATE
- Human judgment required for all deletions
- Regular review of TRASH_CANDIDATE contents recommended