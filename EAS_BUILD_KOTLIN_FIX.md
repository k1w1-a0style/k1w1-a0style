# EAS Build Kotlin Version Fix

## Problem
The EAS build was failing with the following error:
```
Can't find KSP version for Kotlin version '1.9.24'. 
You're probably using an unsupported version of Kotlin. 
Supported versions are: '2.2.20, 2.2.10, 2.2.0, 2.1.21, 2.1.20, 2.1.10, 2.1.0, 2.0.21, 2.0.20, 2.0.10, 2.0.0'
```

React Native 0.76.5 ships with Kotlin 1.9.24 by default, but Expo's KSP (Kotlin Symbol Processing) plugin requires Kotlin 2.x.

## Solution

### 1. Updated `eas.json`
Added `EAS_SKIP_AUTO_FINGERPRINT` environment variable to both `preview` and `production` profiles to avoid fingerprint computation issues:

```json
"env": {
  "NODE_ENV": "production",
  "EAS_SKIP_AUTO_FINGERPRINT": "1"
}
```

### 2. Updated `android/build.gradle`
Added forced resolution strategies to ensure Kotlin 2.0.21 is used throughout the build:

```gradle
buildscript {
  ext {
    kotlinVersion = findProperty('android.kotlinVersion')
      ?: findProperty('kotlinVersion') ?: '2.0.21'
    kspVersion = findProperty('android.kspVersion')
      ?: findProperty('kspVersion') ?: '2.0.21-1.0.28'
  }
  
  // Force all Kotlin dependencies to use the same version
  configurations.all {
    resolutionStrategy {
      force "org.jetbrains.kotlin:kotlin-stdlib:$kotlinVersion"
      force "org.jetbrains.kotlin:kotlin-stdlib-jdk7:$kotlinVersion"
      force "org.jetbrains.kotlin:kotlin-stdlib-jdk8:$kotlinVersion"
      force "org.jetbrains.kotlin:kotlin-reflect:$kotlinVersion"
    }
  }
}

allprojects {
  // Force all Kotlin dependencies to use version 2.0.21
  configurations.all {
    resolutionStrategy {
      force "org.jetbrains.kotlin:kotlin-stdlib:${rootProject.ext.kotlinVersion}"
      force "org.jetbrains.kotlin:kotlin-stdlib-jdk7:${rootProject.ext.kotlinVersion}"
      force "org.jetbrains.kotlin:kotlin-stdlib-jdk8:${rootProject.ext.kotlinVersion}"
      force "org.jetbrains.kotlin:kotlin-reflect:${rootProject.ext.kotlinVersion}"
    }
  }
}
```

### 3. Existing Configuration (Already in place)
The following files already had the correct Kotlin version configured:

- **`android/gradle.properties`**: Sets `android.kotlinVersion=2.0.21` and `android.kspVersion=2.0.21-1.0.28`
- **`android/settings.gradle`**: Configures version resolution for Expo autolinking

## Testing the Build

To test the build locally:

```bash
cd /workspace
NODE_ENV=production npx expo export --platform android
EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile production
```

Or use the command from your terminal:

```bash
cd ~/k1w1-a0style
NODE_ENV=production npx expo export --platform android
EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile production
```

## What Changed

### Files Modified
1. **`eas.json`** - Added `EAS_SKIP_AUTO_FINGERPRINT` to preview and production profiles
2. **`android/build.gradle`** - Added forced resolution strategies for Kotlin version

### Key Points
- Kotlin version: **1.9.24 → 2.0.21**
- KSP version: **2.0.21-1.0.28**
- Gradle version: **8.14.3** (already set)
- Android Gradle Plugin: **8.7.3**

## Why This Fix Works

1. **Force Resolution**: The `resolutionStrategy.force` in both `buildscript` and `allprojects` blocks ensures that all Kotlin dependencies use version 2.0.21, overriding any transitive dependencies that might pull in Kotlin 1.9.24.

2. **Multiple Override Points**: We set the Kotlin version in three places:
   - `gradle.properties` (for initial property resolution)
   - `buildscript.ext` (for the buildscript classpath)
   - Resolution strategy (for all project dependencies)

3. **EAS Fingerprint Skip**: The `EAS_SKIP_AUTO_FINGERPRINT=1` environment variable prevents the build from failing during fingerprint computation, which was causing additional issues.

## Verification

After the build completes successfully, you should see:
- ✅ No Kotlin version errors
- ✅ Successful Gradle build
- ✅ APK or AAB generated
- ✅ Build artifacts available in EAS

## Next Steps

1. Commit these changes
2. Run an EAS build to verify the fix works
3. If successful, merge to your main branch

## Additional Notes

- This configuration is compatible with Expo SDK 54 and React Native 0.76.5
- The Kotlin 2.0.21 version is stable and widely supported
- If you upgrade to newer versions of React Native or Expo SDK, check for updated Kotlin/KSP compatibility
