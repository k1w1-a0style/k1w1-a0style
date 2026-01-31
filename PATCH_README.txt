Apply:
  unzip -o Mobile-APK-Builder-PATCH26.zip
  rm Mobile-APK-Builder-PATCH26.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): apk-only fixes + githubService repair"
  git push origin build

In-app verify:
  - Diagnostics → Run
  - Warn cards should show Fix buttons and, once applied, stay gone (writeback + conflict-safe).

