Apply:
  unzip -o Mobile-APK-Builder-PATCH11.zip
  rm Mobile-APK-Builder-PATCH11.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): support array files in preflight checks"
  git push origin build

