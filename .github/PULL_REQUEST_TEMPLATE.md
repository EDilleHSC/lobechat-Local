## Summary

Short description of the change and why it is needed.

## Testing
- [ ] Unit tests (node) passed
- [ ] Python unit tests passed (mailroom)
- [ ] Router→Mailroom smoke job passes in CI

## Checklist
- [ ] `MAILROOM_PYTHON` job env set in CI (or python available on runners)
- [ ] Packages created by applier are present in `NAVI/packages`
- [ ] Mailroom delivers packages to `NAVI/offices/<OFFICE>/inbox`
- [ ] No `agents/agent1` artifacts remain

Please include any notes for reviewers and maintainers.