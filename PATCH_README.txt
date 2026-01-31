Apply:
  unzip -o Mobile-APK-Builder-PATCH7.zip
  rm Mobile-APK-Builder-PATCH7.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): repair repo file read + projectId detection"
  git push origin build
