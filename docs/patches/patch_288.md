# Patch 288

## Goals

Finish the cleanup after the earlier refactor patches by fixing the remaining TypeScript issues and the Jest parse failure.

## Changes

- **CiLiteHeaderButton**: loosen `addChatMessage` callback typing to allow sync or async handlers.
  - `components/CiLiteHeaderButton/components/ActionButtons.tsx`
  - `components/CiLiteHeaderButton/components/CiLiteModal.tsx` (already aligned)

- **Sandpack builder/types**: remove conflicting local `SandpackOptions` type and rely on the canonical one from `sandpackHelpers` (includes `title`).
  - `lib/sandpackBuilder.ts`

- **Diagnostics**:
  - Import missing `DiagnosticCheck` type in pipeline diagnostics.
    - `lib/diagnostics/buildPipelineDiagnostics.ts`
  - Import missing `safeTrim` in remote diagnostics.
    - `lib/diagnostics/remoteDiagnostics.ts`
  - Remove duplicate `Status` import to stop Jest/Babel parser crash.
    - `screens/DiagnosticScreen/hooks/diagnosticRunners.ts`

- **AIContext barrel export**: re-export `useAI` from `contexts/AIContext.tsx` so screens importing from `contexts/AIContext` compile.
  - `contexts/AIContext.tsx`

- **Code screen file actions hook**: bring referenced types into scope.
  - `screens/CodeScreen/hooks/useFileActions.ts`

- **Credentials wizard**: import the missing mode normalization helpers.
  - `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`

- **GitHub repos screen**: import `CORE_TEMPLATE_FILES` used in the loop.
  - `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`

- **Chat JSON utils**: import `normalizePath` from `utils/url`.
  - `utils/chatJsonUtils.ts`

## Expected result

- `npm run typecheck` no longer complains about missing exports/types (including `useAI`) or Sandpack `title`.
- Jest no longer fails parsing `diagnosticRunners.ts` due to the duplicated `Status` import.
