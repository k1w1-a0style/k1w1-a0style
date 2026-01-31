PATCH37 - EAS CI Build Fix (Android)

Why your build fails right now
1) "expo-dev-client" is in package.json but not installed
   - In the current workflow, an Expo/EAS command runs before dependencies are installed.
   - Result: Expo CLI checks node_modules, doesn't find expo-dev-client, and aborts.

2) "Generating a new Keystore is not supported in --non-interactive mode"
   - EAS is trying to use remote Android credentials, but no keystore exists yet.
   - In GitHub Actions (non-interactive), EAS cannot prompt you to generate one.

3) (Older issue) "Failed to find build.gradle" / android.package ignored
   - When an incomplete android/ or ios/ directory exists, EAS treats the project as "bare" and then fails.

What this patch changes
- Rewrites BOTH workflows:
  - .github/workflows/k1w1-triggered-build.yml
  - .github/workflows/eas-build.yml
- Always installs deps first.
- Deletes incomplete android/ and ios/ directories before EAS runs.
- For development/preview profiles ONLY:
  - Generates a temporary local keystore inside the CI workspace.
  - Switches the build profile to use local signing for that run.
- For production:
  - Fails fast with a clear message (you must configure real signing once).

How to apply
1) In your project root (k1w1-a0style):
   unzip -o Mobile-APK-Builder-PATCH37.zip
   rm Mobile-APK-Builder-PATCH37.zip

2) Commit & push to the build branch:
   git add .github/workflows/eas-build.yml .github/workflows/k1w1-triggered-build.yml
   git commit -m "fix(ci): make EAS android builds non-interactive safe"
   git push origin build

Notes
- The temporary CI keystore is ONLY for dev/test APKs. Do NOT use it for production releases.
- If you want production builds (AAB): run once locally (interactive):
    eas credentials -p android
  ...and configure proper signing.
