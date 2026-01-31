Apply:
  unzip -o Mobile-APK-Builder-PATCH19.zip
  rm Mobile-APK-Builder-PATCH19.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(diagnostics): make autofix changes stick on immediate re-scan"
  git push origin build

UI verify:
  - Diagnostics -> press Fix on a warn -> immediately press Run.
  - The previously fixed warn should not reappear.

