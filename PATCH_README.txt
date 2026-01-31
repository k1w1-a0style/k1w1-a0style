Apply:
  unzip -o Mobile-APK-Builder-PATCH16.zip
  rm Mobile-APK-Builder-PATCH16.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(ci): auto-init EAS project before builds"
  git push origin build

E2E verify:
  - Trigger a build in-app against a repo/branch that has no prior EAS linkage.
  - GH run should pass the init step and proceed to 'Run EAS Build (WAIT)'.

