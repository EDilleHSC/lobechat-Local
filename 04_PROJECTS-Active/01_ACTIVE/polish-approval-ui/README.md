# Feature: Polish Approval UI Copy + Accessibility ✨

Goal

- Improve copy clarity and tone in the Approval UI and harden accessibility so the approval flow is usable for keyboard and screen-reader users.

Acceptance criteria

- All approval UI copy is concise and consistent with product voice.
- ARIA roles/labels added where needed; keyboard navigation works end-to-end.
- Color contrast meets WCAG AA (prefer AAA where sensible) for approval banner/buttons.
- Automated tests (unit + smoke) exist for copy & basic accessibility checks.
- CI runs pass and workflow smoke tests succeed for approval flow.

Planned tasks

1. Update copy (labels, buttons, docstrings)
   - Files likely impacted: `src/ui/approval/*`, `templates/approval/*` (search repo for 'Approval' strings)
   - Add copy review notes in this file and request PO/UX review

2. Accessibility changes
   - Add ARIA attributes (role, aria-label, aria-describedby) where needed
   - Ensure all interactive elements are keyboard accessible and have visible focus
   - Add accessible names for images/icons
   - Add automated axe-core or equivalent checks to CI

3. Tests
   - Unit tests for components with changed copy
   - Integration/smoke test that posts an approval and verifies audit logging (existing smoke can be extended)

4. CI
   - Add accessibility check step to `ci` smoke or pre-merge workflow

5. PR & review
   - Push branch, create PR, include checklist and test screenshots/notes

Notes / References

- Local smoke test script: `scripts/test_ui_approval_smoke.ps1` (Windows) and `scripts/test_ui_approval_smoke.sh` (bash)
- Approval audit log lives at: `NAVI/approvals/` — tests should assert an entry was created

Next step

- I will create branch `feat/polish-approval-ui`, commit this file, and push the branch.
