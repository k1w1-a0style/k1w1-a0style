# Agent Instructions — Mobile APK Builder

When working on this repo, assume:
- This is an **automated APK builder** built around **Expo/EAS + GitHub Actions**.
- The app chooses the **target repo and branch/ref at runtime**. Workflows/templates must **NOT hard-pin** a branch.
- CI must stay **non-interactive**. Anything that requires prompts must be avoided or clearly documented as a one-time manual setup step.

## WORKFLOW_CONTRACT (non-negotiable)
1) The selected repo/ref comes from the app/user and must flow through provisioning + workflow dispatch.
2) Secrets/tokens belong in GitHub Secrets/Variables (or the app’s secure storage), not committed.
3) Provisioning must be idempotent (safe to run repeatedly).
4) “Self-heal” logic may fix missing lockfiles/dev-client, but must never silently make destructive changes.

## Required engineering behavior
- Prefer stable automation over clever shortcuts.
- If you add or change workflow behavior, update:
  - workflow templates,
  - diagnostics/preflight checks,
  - docs (AI_START_HERE.md / PROJECT_CONTEXT.md).
- Keep the repo clean: avoid generating lots of patch-manifest files.

## Android signing (practical reality)
- Android builds on EAS generally require signing credentials (keystore) to exist on EAS.
- In GitHub Actions (`--non-interactive`), EAS cannot generate a new keystore for you.
  If credentials are missing you’ll see: “Generating a new Keystore is not supported in --non-interactive mode”.

### What to do
- Provision Android credentials **once** outside CI:
  - run `eas credentials -p android` locally and generate/upload a keystore, OR
  - configure credentials in the Expo dashboard for the project.

### Optional alternative
You *can* experiment with unsigned debug builds (e.g. `android.withoutCredentials: true` in a build profile),
…but do not assume it works across all SDK/CLI versions. If you use it, document the tradeoffs and keep production signed.
