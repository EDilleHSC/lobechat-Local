# Repository-level compliance summary

This file provides the repository-level allow-list used by `tools/check_root_structure.py` and the `compliance/check-root-structure` workflow. It mirrors the system-level `D:\README_COMPLIANCE.md` for repository checks.

## Approved root structure (repo)
- .git
- .github
- .gitignore
- .gitleaks.toml
- .pre-commit-config.yaml
- CHANGELOG.md
- Dockerfile
- docker-compose.yml
- package.json
- package-lock.json
- README.md
- docs/
- scripts/
- tools/
- src/
- runtime/
- tests/
- ci/
- pipelines/
- docs/

## Repository exceptions (allowed root items)
The following items are allowed or expected at the repository root (informational guidance):

- Versioning & CI metadata: `.git`, `.github/`, `.gitignore`, `.gitleaks.toml`, `.pre-commit-config.yaml`, `CHANGELOG.md`
- Project manifests & build files: `package.json`, `package-lock.json`, `Dockerfile`, `docker-compose.yml`, `jest.config.cjs`, `playwright.config.js`
- Docs & governance: `README.md`, `REMEDIATION.md`, `docs/`
- Source and runtime trees: `src/`, `runtime/`, `scripts/`, `tools/`, `ci/`, `pipelines/`, `tests/`
- Developer artifacts (should be gitignored where appropriate): `.pytest_cache/`, `__pycache__/`, `tmp/`, `*.log`, `*.zip` (these should be added to `.gitignore` when appropriate)

Notes:
- `node_modules/` should not be committed to the repository root; if present accidentally, remove and add to `.gitignore`.
- This repository-level file is authoritative for PR-time compliance checks run by CI. For system-level drive rules, refer to `D:\README_COMPLIANCE.md`.
