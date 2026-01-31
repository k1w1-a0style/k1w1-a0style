Apply:
  unzip -o Mobile-APK-Builder-PATCH21.zip
  rm Mobile-APK-Builder-PATCH21.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): write back autofix changes to linked repo"
  git push origin build

In-app verify:
  - Open Diagnostics on a linked repo/branch
  - Press Fix on a pipeline warning (e.g. eas.json buildType)
  - Run Diagnostics again → warning must be gone (because repo file is updated).

