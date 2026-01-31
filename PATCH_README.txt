Apply:
  unzip -o Mobile-APK-Builder-PATCH17.zip
  rm Mobile-APK-Builder-PATCH17.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): provide autofix patches for warnings"
  git push origin build

Verify in app:
  - Open Diagnostics → Run → you should see the same warnings BUT now with Fix available.
  - Tap AutoFix → warnings should drop and eas.json/app.config.js should be patched.

