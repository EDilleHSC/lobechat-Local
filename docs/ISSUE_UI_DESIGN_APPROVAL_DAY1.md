Title: UI polish for Design Approval page — feedback from Day 1 run
Labels: ux, beta, enhancement

Body:

**Summary**
During the Day 1 operator simulation (snapshot ID: `2025-12-19T09-52-53-444Z`, approval: `2025-12-19T09-52-54-615Z-test-beta-desk1.approval.json`), the following UX issues and enhancement opportunities were identified for the Design Approval page.

**Reproduction steps**
1. Start server (Review Mode) with `MCP_APPROVAL_TOKEN=TEST_APPROVAL`.
2. Drop sample file into `NAVI/inbox`.
3. POST `/process` and open `http://localhost:8010/presenter/design-approval.html`.

**Observed issues / suggestions**
- Add confirmation message after an approval is submitted. The message should include a link to the persisted `.approval.json` file and a note that `audit.log` was appended.
- Display an explicit, discoverable notice or link to view `audit.log` (or last few lines) from the UI.
- Add short tooltips or inline help for the `checklist` fields to clarify what each item means (layout, accessibility, bugFixed, production).
- Add a "Copy Snapshot ID" button near the header and a small "What I did" summary area showing the current snapshot and most recent approver.
- Consider adding inline instructions for operators who run the script without `MCP_APPROVAL_TOKEN` (e.g., link to operator docs) or provide an on-page banner when approvals are disabled.

**Acceptance criteria**
- After approval, the UI shows a success banner with a link to the literal file path or downloads the `.approval.json`.
- The UI provides an accessible way to view the latest audit entries for the current snapshot.
- Checklist fields include a tooltip and sample guidance text.
- Snapshot ID is copyable with one click.

**Priority**: P2 (UX polish — improves trust and reduces friction)

**Notes**: Feedback logged as part of Day 1 test run. See `docs/UX_FEEDBACK_TEMPLATE_BETA0.md` for operator comments.
