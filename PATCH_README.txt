Apply:
  unzip -o Mobile-APK-Builder-PATCH27.zip
  rm Mobile-APK-Builder-PATCH27.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): apk-only dev flow check + fix"
  git push origin build

In-app verify:
  - Diagnostics → Run
  - The last warning should now be either PASS (internal APK) or offer a Fix (if developmentClient=true).

