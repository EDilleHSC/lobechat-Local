Mail Room folders:

- processing/         # files currently being analyzed
- clarified/          # sidecar JSON written, awaiting routing
- review_required/    # items below confidence threshold for human review

Process: watcher moves files -> processing -> clarified (sidecar) -> either sorted/ or review_required/
Refer to NAVI/config/routing_config.json for routing rules and thresholds.