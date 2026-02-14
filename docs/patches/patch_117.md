# Patch 117: fix preflightChecks + workflow YAML name quoting

## Fix
- Repairs/solidifies the preflight check implementation so it matches the actual `PreflightCheck` / `PreflightCheckFn` types (sync `run`, no unsupported fields).
- Adds a new **critical** preflight check that scans `.github/workflows/*.yml|yaml` for `name:` and `- name:` values containing `": "` that are **not quoted**, and offers an auto-fix that quotes them safely.

## Impact
- Prevents “workflow doesn’t start / YAML parse error” issues from sneaking through when the app auto-generates or patches workflows.

