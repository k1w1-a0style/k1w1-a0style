How to apply:
1) From your project root (k1w1-a0style), run:
   unzip -o Mobile-APK-Builder-PATCH33.zip
   rm Mobile-APK-Builder-PATCH33.zip

2) Verify:
   npm run typecheck
   npm run lint:ci
   npm run test:silent

3) Commit & push:
   git add -A
   git commit -m "fix(ui): cleanup-native dialog compile"
   git push origin build
