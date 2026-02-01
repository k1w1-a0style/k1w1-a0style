PATCH 39 – CI Fixes (EAS / Android)

What this patch fixes
1) ✅ Keystore error in CI ("Generating a new Keystore is not supported in --non-interactive mode")
   - Non-production (development/preview) builds now generate a local JKS keystore in the workflow
     and force EAS to use it via eas.json (credentialsSource: local).
   - Result: CI no longer depends on remote Android credentials for dev builds.

2) ✅ Broken android/ios folders blocking EAS
   - If android/ or ios/ exist but look incomplete, they get removed before the EAS build.

3) ✅ Self-heal regex bug (grep: Unmatched ( or \()
   - Fixed the grep pattern that checks for '??' lines from `git status --porcelain`.

4) ✅ expo-dev-client install reliability (development only)
   - If expo-dev-client is required but not installed, CI installs it directly with npm.

5) ✅ Artifacts are no longer empty
   - CI now uploads build/eas-build-info.txt containing Build ID + Build URL.

Notes / intended behavior
- Production builds are blocked in CI (on purpose). Production signing should be done via EAS dashboard
  or a trusted local machine where credentials are configured.
- If your main branch is protected, the self-heal commit (package-lock / dev-client) may fail to push.
  In that case, just commit package-lock.json manually once.

How to apply
1) Unzip into your repo root (overwrite files).
2) Commit + push.
3) Re-run the GitHub Action.

