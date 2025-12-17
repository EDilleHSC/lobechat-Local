System intent and operating rules are defined in `docs/VBOARDER_CANON.md` — changes must align with it.

See `docs/STRUCTURE.md` for VBoarder structure v1 and `docs/README_PRODUCTION.md` for production run instructions.

Notes:
- Processing code and servers have been moved into `pipelines/` and `runtime/` respectively. Root now contains only thin shims and docs.

Security: a CI guard has been enabled to prevent future regressions; see `.github/workflows/root-guard.yml`. To allow an exception, add `# ROOT_EXCEPTION_OK` to the file and document the reason in your PR.
