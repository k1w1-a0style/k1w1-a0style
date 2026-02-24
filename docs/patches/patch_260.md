# Patch 260: Best-effort GitHub push should not block workflow autofix

## Fix
- `bestEffortPushToGitHub()` no longer aborts the whole build start flow if `pushFilesToRepo()` fails.
- We now catch push errors, log a warning, and still:
  - proceed with `autoFixCIWorkflows({ owner, repo, branch })`
  - continue with the build using the linked branch / resolved default branch

## Why
The APK Builder can still trigger a GitHub workflow on the existing branch even if the latest file push failed.
Workflows provisioning should be attempted regardless, so CI never gets stuck in a half-configured state.
