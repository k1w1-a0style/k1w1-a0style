PATCH README - Mobile APK Builder

Apply (from your project root):
1) Copy this ZIP into your project root folder.
2) Unzip with overwrite:
   unzip -o Mobile-APK-Builder-PATCH.zip
3) Delete the ZIP:
   rm Mobile-APK-Builder-PATCH.zip

Verify locally (from project root):
npm run typecheck
npm run lint
npm run lint:ci
npm run test:silent

Commit & push:
git status
git add -A
git commit -m "fix(build): E2E build flow + logs + result links"
git push

What this patch fixes:
- Makes the in-app build polling resilient by aligning UI parsing with the Edge function response.
- Makes check-eas-build return stable top-level + job fields and correct error_message.
- Fixes workflow failure updates so jobs don't get stuck.
- Fixes in-app log fetching by aligning with github-workflow-runs/logs Edge functions.
- Adds UI buttons for Artifacts and Build Result.

Notes:
- This patch only updates existing files. No new runtime dependencies.
- No service role / admin keys are exposed in the client.
