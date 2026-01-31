Mobile APK Builder – PATCH30

Symptom
- CI EAS build fails with:
  "Failed to find 'build.gradle' file for project: .../android/app"
- Sometimes also:
  '"expo-dev-client" ... doesn't seem to be installed'

Root cause
Your linked repo can end up containing an incomplete android/ (and/or ios/) directory.
The moment an android/ folder exists, EAS treats the project as a native/bare build and expects full Gradle files.
If only AndroidManifest.xml got synced, build.gradle is missing => hard fail.

Fix (CI safety net)
Before running EAS, the workflow now:
1) Detects broken native dirs and removes android/ + ios/ on the runner (forces managed EAS build)
2) Normalizes eas.json for APK-only behavior and disables dev-client requirement by default for development
3) If expo-dev-client is declared in package.json, it ensures it is installed

Files changed
- .github/workflows/k1w1-triggered-build.yml
- .github/workflows/eas-build.yml
