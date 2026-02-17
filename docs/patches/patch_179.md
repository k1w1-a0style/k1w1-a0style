# Patch 179: CI Lite dispatch reliability + header buttons theming

## Summary
- Fix CI Lite workflow dispatch for project repos by:
  - Allowlisting CI Lite workflow files for repo sync
  - Passing the device GitHub token through to Edge dispatch
  - Adding workflow filename fallback (adds .yml/.yaml if needed)
- Make header action buttons match chat theme (no black blocks, hairline borders)

## Files changed
- `infra/github/utils.ts`
- `components/CiLiteHeaderButton.tsx`
- `components/ChatHeaderActions.tsx`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `supabase/functions/_shared/validation.ts`

## Verification
1. In app: open header CI Lite modal and press **Run**.
2. Confirm no `github-workflow-dispatch ... 404 Not Found` error.
3. GitHub Actions should show a run for **K1W1 CI Lite (Lint + Typecheck)** (not the build workflow).
4. Header buttons background matches chat green tint and borders are thin.

## Notes
If you intentionally run the build pipeline, use the build action/workflow (`K1W1 Triggered Build`). CI Lite should only lint + typecheck.
