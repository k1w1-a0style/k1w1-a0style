PATCH29: Fix EAS build failures.

Changes
1) Workflows remove incomplete native folders:
   - delete android/ when android/app/build.gradle(.kts) is missing
   - delete ios/ when ios/Podfile is missing
2) k1w1-triggered-build.yml regenerates package-lock.json from package.json before calling eas build.

Apply
unzip -o Mobile-APK-Builder-PATCH29.zip
