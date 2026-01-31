Apply:
  unzip -o Mobile-APK-Builder-PATCH15.zip
  rm Mobile-APK-Builder-PATCH15.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(final): allow safe branches + APK-only production template"
  git push origin build

