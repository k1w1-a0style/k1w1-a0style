# Patch 235: Post-234 critical cleanup (HF indent + safer fallbacks + dedupe constants)

## Scope
Small follow-up after Patch 234 based on latest review:
- Fix remaining HuggingFace `signal` indentation in `lib/orchestrator.ts` (style-only).
- Make `resolveLegacyAutoMode()` fallback explicit per call-site (avoids wrong fallback if provider defaults ever go missing).
- Deduplicate the "Supabase URL fehlt ..." error string via exported constant.
- Migrate a few remaining peripheral `console.*` calls to `logger.*` (non-runtime-critical hygiene).

## Files changed
- `lib/orchestrator.ts`
- `contexts/AIContext.tsx`
- `lib/supabaseEdge.ts`
- `project/services/buildPollingService.ts`
- `hooks/useGitHubActionsLogs.ts`
- `screens/EnhancedBuildScreen/components/WorkflowRunDetailModal.tsx`
- `utils/chatUtils.ts`

## Notes
No behavioral changes intended beyond safer fallbacks + shared error constant. All other edits are formatting/logging hygiene.
