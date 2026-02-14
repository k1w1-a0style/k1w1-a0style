# Patch 112: Fix invalid workflow YAML + managed workflow self-healing

## What was happening
- GitHub rejected `.github/workflows/k1w1-triggered-build.yml` with **"Invalid workflow file"**.
- Root cause: a step name with **colon + space** was emitted without quotes, e.g.

```yml
- name: Update Supabase job: running
```

In YAML, `:` followed by a space can be interpreted as a key/value separator unless the scalar is quoted, so the workflow becomes invalid.

## Fix
### 1) Quote the problematic step name
- The workflow generator now emits:

```yml
- name: "Update Supabase job: running"
```

### 2) Allow updating *managed* workflows when pushing project files
- Previously, `.github/workflows/*` was always skipped during push.
- Now we still **skip unmanaged workflow files**, but we **do push a small whitelist** of workflows that this project owns (managed).
- Goal: if a workflow breaks (like this YAML issue), the tool can repair it automatically.

## Files changed
- `lib/diagnostics/ciAutoFix.ts`
- `contexts/githubService.ts`

## Notes / safety
- Workflow updates are still restricted to a whitelist to avoid clobbering custom workflows.
