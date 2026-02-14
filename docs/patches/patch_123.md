# Patch 123

## Fixes

### 1) Diagnostic: Critical Workflow YAML Check no longer crashes
The preflight check **"Workflow YAML: quote names containing ': '"** crashed because it returned `fail(...)` (undefined).
It now returns a proper `PreflightCheckResult` with `status: "fail"` and the same auto-fix patch.

**Files**
- `lib/diagnostics/preflightChecks.ts`

### 2) GitHub Sync: workflow allowlist works even with odd path formats
`pushFilesToRepo` compared workflow paths against the allowlist **without normalizing**.
If any incoming file path contained `./` or backslashes (Windows-style), the allowlist check could fail and the app would log:
`Skip unmanaged workflow file: ...`

Now workflow paths are normalized before the allowlist check and before upload.

**Files**
- `contexts/githubService.ts`
