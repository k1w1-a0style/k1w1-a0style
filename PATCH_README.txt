Apply:
  unzip -o Mobile-APK-Builder-PATCH13.zip
  rm Mobile-APK-Builder-PATCH13.zip

Verify:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit + push:
  git add -A
  git commit -m "fix(ci): allow safe arbitrary branches for in-app builds"
  git push origin build

Verify in GitHub Actions:
- Trigger an in-app build from a non-standard branch name (e.g. feature/test).
- Ensure 'Determine checkout ref' no longer fails with 'Ref not allowed'.

