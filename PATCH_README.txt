Apply:
  unzip -o Mobile-APK-Builder-PATCH14.zip
  rm Mobile-APK-Builder-PATCH14.zip

Supabase setup (one-time):
  - Create Storage bucket 'apk-builds' (private recommended).
  - Optionally set GH secret SUPABASE_APK_BUCKET to another bucket name.

Verify (local):
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Deploy edge functions (if needed):
  supabase functions deploy check-eas-build
  supabase functions deploy github-workflow-logs
  supabase functions deploy github-workflow-runs
  supabase functions deploy github-workflow-dispatch

Commit + push:
  git add -A
  git commit -m "fix(final): diagnostics 3 flows + ci auto-init + signed apk download_url"
  git push origin build

E2E verify:
  - In app: run Diagnostics → should show results for development/preview/full(production) + pipeline section.
  - Trigger build → build_jobs.download_url should be filled → app shows Download button.

