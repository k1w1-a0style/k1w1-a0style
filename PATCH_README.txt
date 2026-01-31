Apply:
  unzip -o Mobile-APK-Builder-PATCH20.zip
  rm Mobile-APK-Builder-PATCH20.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): make applied fixes sticky for immediate re-scan"
  git push origin build

Manual verification:
  - Diagnostics → Run
  - Apply a Fix
  - Immediately press Run again → the fixed warn must not return.

