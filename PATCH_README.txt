Apply:
  git restore lib/diagnostics/buildPipelineDiagnostics.ts contexts/githubService.ts
  unzip -o Mobile-APK-Builder-PATCH24.zip
  rm Mobile-APK-Builder-PATCH24.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): pipeline fix typing + github sha-mismatch retry"
  git push origin build

In-app verify:
  - Diagnostics → apply Fix on eas.json related warning
  - Should no longer log 'sha does not match ...' frequently; writeback should succeed.

