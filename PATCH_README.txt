Apply (project root):
  unzip -o Mobile-APK-Builder-PATCH5.zip
  rm Mobile-APK-Builder-PATCH5.zip

Verify locally:
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Commit & push:
  git add -A
  git commit -m "fix(ci): auto-init EAS project + resilient config + profile fallback"
  git push origin build

Deploy updated edge functions: (not needed for this patch)
  (none)

Expected result:
- GitHub Actions no longer fails with 'EAS project not configured' even for fresh repos/branches.
- If a target project lacks expo-dev-client, development builds fall back to preview APK automatically.
