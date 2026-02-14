# Patch 122: Persist Build Profile across screens (safe sync)

## What was broken
- The Credentials Wizard could drift away from the Build Screen selection (dev/preview/production).
- Earlier fixes accidentally used `await` directly inside a `useEffect` callback (invalid syntax).

## What changed
In `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`:
- Export `normalizeModeForUi` / `normalizeModeForApi` so other hooks can share the same mapping.
- Allow nullable `preferredBuildProfile` (`string | null | undefined`).
- Initialize the wizard mode from `project.projectData.preferredBuildProfile` (default: `dev`).
- Keep the wizard mode in sync both ways:
  - If the profile changes elsewhere (Build Screen), update the wizard UI.
  - If the wizard UI changes, persist it back to `ProjectContext`.
- No `await` inside `useEffect`: the async setter is called fire-and-forget (`void ...`).

## Expected behavior now
- Pick **Dev** in the Build Screen → Credentials Wizard shows **Dev** automatically and keeps it.
- Pick **Preview/Production** → same behavior.
- Switching projects/branches will follow that project’s persisted `preferredBuildProfile`.
