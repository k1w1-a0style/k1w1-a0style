# PROJECT CONTEXT — Mobile APK Builder

## Product in one sentence
A mobile app that turns **repo + secrets + build profile** into an **automated EAS Android build (APK/AAB)**, executed by GitHub Actions.

## What this repository is
This repository contains the **builder app** (Expo / React Native). It does **not** compile Android on the phone.
Instead it orchestrates builds by:

1) collecting and validating credentials (GitHub token, Expo/EAS token, optional Supabase keys),
2) provisioning a target repository (workflows, EAS config, templates),
3) triggering GitHub Actions runs that call **EAS Build**,
4) tracking build status and surfacing logs + download links.

## Key user-facing screens (conceptual)
- **Connection / Secrets screen**
  - user pastes tokens/keys
  - values are saved persistently on-device
  - app can push required GitHub Secrets/Variables to the target repo
- **Repo management**
  - select repo + branch (should be *user-selectable*, persisted)
  - repos can be added/renamed/removed; provisioning should be idempotent
- **Diagnostic screen**
  - checks that the target repo is “build-ready”
  - should catch common foot-guns early (missing secrets, missing workflows, missing EAS config, accidental native folders, etc.)
- **Build screen**
  - three profiles: development / preview / production
  - triggers builds, shows progress, stores last build IDs/URLs

## Build profiles (what they mean here)
- **development**
  - primary mode used during app development
  - typically produces an **APK**
- **preview**
  - a “lightweight” build for quick sharing/testing
  - should still be reproducible and not destroy the dev flow
- **production**
  - release builds; typically produces an **AAB**

> IMPORTANT: All three Android profiles still require Android signing credentials on EAS. CI runs in --non-interactive mode and cannot “create” a keystore for you.

## Non-negotiable workflow contract (must remain true)
- The builder must **NOT** hard-pin the target repo branch inside workflow templates.
  - The branch/ref is chosen by the user in the app, and workflows should operate on that selected ref.
- Secrets/tokens should be handled via GitHub Secrets/Variables, not committed.
- Scoped admin contract is explicit: Workflow/build/artifact routes use workflow-scoped admin key material, keystore routes use keystore-scoped admin key material, and legacy edge admin keys are compatibility-only.
- Provisioning should be safe to run multiple times (idempotent).
- “Auto-fix/self-heal” steps must never silently change the target repo in a destructive way.

## Known recurring failure modes (and how we handle them)
### 1) Incomplete native folders committed
This often happens when someone runs a native prebuild locally and commits partial output.
EAS (managed) can then fail when files like `android/app/build.gradle` are missing.

Mitigation:
- GitHub Actions workflow performs a preflight that deletes **incomplete** native folders (to let EAS regenerate them cleanly).
- Diagnostic screen should warn when it detects native folders in the repo.

### 2) Missing Android keystore on EAS (CI cannot generate it)
If EAS credentials are missing, you will see:
“Generating a new Keystore is not supported in --non-interactive mode”

Mitigation:
- Workflow detects that specific failure text and prints a clear error message.
- User must provision Android credentials once interactively (outside CI):
  - run `eas credentials -p android` locally and generate/upload a keystore, OR
  - set credentials in the Expo dashboard for the project.

## “Preview build” expectation (future direction)
A “real preview” could mean:
- a web preview (Expo web / static preview),
- screenshots/manifest preview,
- or a lightweight installable APK that at least launches and shows UI.

This repo’s contract is: preview must be clearly defined, automated, and must not break dev/production builds.

## How to hand this repo to another AI/agent
Point them to **AI_START_HERE.md** and ask them to read it first.
For safety, instruct the agent:
- do not change workflow contracts,
- propose changes first, then implement in small, testable steps,
- keep repo clean (avoid generating lots of “patch manifest” files).
