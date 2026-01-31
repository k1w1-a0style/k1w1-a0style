Apply:
  unzip -o Mobile-APK-Builder-PATCH18.zip
  rm Mobile-APK-Builder-PATCH18.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "chore(diagnostics): unique id for package.json read warn"
  git push origin build

