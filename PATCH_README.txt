Apply:
  unzip -o Mobile-APK-Builder-PATCH12.zip
  rm Mobile-APK-Builder-PATCH12.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): APK-only eas.json template for all profiles"
  git push origin build

