# VBoarder COLLECTION → INBOX Promotion Protocol

## Purpose
This protocol ensures that files moved from COLLECTION to INBOX are:
- Reviewed and approved
- Have clear purpose and destination
- Maintain Inbox integrity

## Promotion Requirements

### File Must Be:
1. **Reviewed**: Human has examined the file
2. **Approved**: Explicit decision to promote
3. **Purposeful**: Has a specific reason for Inbox placement
4. **Targeted**: Has a destination agent/workflow in mind

### Promotion Process
1. **Review Batch**: Examine files in COLLECTION/BATCHES/
2. **Make Decision**: Move to REVIEW, HOLD, or TRASH_CANDIDATE
3. **Select for Promotion**: Only approved files move to Inbox
4. **Manual Move**: Use file explorer or script to move files
5. **Log Promotion**: Record in `promotion_log.json`

### Quality Gates
- **No Blind Promotion**: Never move entire batches without review
- **One at a Time**: Review individual files, not just batch metadata
- **Context Matters**: Consider file relationships and dependencies
- **Inbox Health**: Monitor Inbox size and processing load

## Why This Protocol Exists

### Protects Inbox Integrity
- Prevents bulk dumps from overwhelming daily operations
- Maintains signal-to-noise ratio in Inbox
- Preserves deterministic processing expectations

### Ensures Quality
- Every Inbox file has been vetted
- Reduces processing errors and false positives
- Maintains trust in the system

### Long-term Sustainability
- Prevents Inbox bloat from accumulation
- Enables measured growth of processing capacity
- Supports scaling without quality degradation

## Implementation Notes
- **Tools**: Use Windows Explorer for manual moves
- **Logging**: Track promotions for audit purposes
- **AIR Role**: AIR provides analysis but not promotion decisions
- **Frequency**: Promote in controlled batches, not continuously

## Emergency Override
In rare cases where immediate processing is required:
- Document the emergency reason
- Get explicit approval
- Process immediately but review afterward