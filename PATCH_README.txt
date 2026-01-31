# PATCH: Fix EAS build failing due to partial android/ios folders

## Problem (from your logs)
- EAS detects an `android/` directory and switches to the **bare** workflow.
- In your repo, `android/app/build.gradle` is missing, so the build aborts:
  `Failed to find 'build.gradle' file for project: .../android/app`
- Additionally, Expo can warn that `expo-dev-client` is "not installed" if CI installs only production deps.

## What this patch changes
1) **Do not push `android/` / `ios/` from the app into the linked repo**
   - Applied in:
     - `contexts/ProjectContext.tsx` (build trigger push)
     - `screens/GitHubReposScreen.tsx` (manual push)
   - This stops re-introducing the broken native folders.

2) **CI safety net: strip incomplete native folders before EAS build**
   - In `.github/workflows/k1w1-triggered-build.yml`
   - If `android/` exists **but no Gradle files**, it removes `android/` (and `ios/` if incomplete) so EAS stays in the managed workflow.

3) **Install devDependencies in CI**
   - Forces `NODE_ENV=development` and uses `npm ci --include=dev`.
   - Prevents the "expo-dev-client ... doesn't seem to be installed" error when the package lives in devDependencies.

## How to verify
- Push the patch, then trigger the build again.
- In the build logs you should no longer see:
  - `Specified value for "android.package" ... ignored because an android directory was detected`
  - `Failed to find 'build.gradle' ... android/app`

## Note
If your target repo already contains `android/` / `ios/` from earlier pushes, this patch’s CI step removes them for the build automatically.
If you also want the repo itself to be cleaned permanently, you can delete those folders in the repo once.
