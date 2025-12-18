# Beta‑1 Architecture Draft

## Objective
Beta‑1: Restore production mailroom routing and enable safe, verifiable routing of trusted inputs to agents. The goal is to ensure the system can *route* trusted snapshots to consumers while preserving provenance (TRUST_HEADER), and do so with operational safety and testable guarantees.

## Scope
- Restore/verify Python runtime required by mailroom runner.
- Re-enable mailroom routing as a first-class stage after snapshot (do not compromise the trust invariants).
- Define routing contract and agent dispatch format including trust metadata.
- Add tests and CI to verify end-to-end integrity.

## Key Deliverables
- `mailroom_runner.py` restored and tested.
- Routing contract document and JSON schema.
- Basic router implementation and POC consumer (one agent).
- Integration tests validating trust propagation and routing correctness.
- CI updates to enforce trust propagation tests (fast, deterministic).

## Initial Milestones
1. Runtime restore: confirm Python presence and mailroom runner execution (owner: infra). 1 week
2. Mailroom reactivation: restore runner and tests (owner: mailroom). 1 week
3. Routing spec and POC: define contract and implement POC (owner: routing). 2 weeks
4. Integration & CI: add tests, run in CI, and pass trust propagation criteria (owner: QA/CI). 1 week

## Acceptance Criteria
- Mailroom runner executes reliably on host; snapshots are accepted and processed.
- Router forwards messages to agents with `TRUST_HEADER` metadata intact.
- CI enforces both smoke tests and trust propagation tests on push/PR.
- Documentation updated: architecture doc, `ci/README.md`, and release notes.

## Risks & Mitigations
- Python runtime differences across hosts: provide an installation/fallback (embedded venv) and tests.
- Untrusted routing inputs: enforce allowed paths and input validation; add obs/logging.

## Next Steps (immediate)
- Restore Python runtime checks and implement mailroom smoke test.
- Draft routing contract and JSON schema.
- Implement a small router and a mock agent to validate flow.

---
(See the Beta‑1 todo list for detailed tasks.)
