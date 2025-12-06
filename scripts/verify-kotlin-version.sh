#!/bin/bash

# Script to verify Kotlin version configuration for EAS builds
# This checks that all Android build files have the correct Kotlin version set

set -e

echo "🔍 Verifying Kotlin version configuration..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check gradle.properties
echo "📄 Checking android/gradle.properties..."
if grep -q "android.kotlinVersion=2.0.21" android/gradle.properties && \
   grep -q "kotlinVersion=2.0.21" android/gradle.properties && \
   grep -q "android.kspVersion=2.0.21-1.0.28" android/gradle.properties && \
   grep -q "kspVersion=2.0.21-1.0.28" android/gradle.properties; then
    echo -e "${GREEN}✓${NC} gradle.properties has correct Kotlin version (2.0.21)"
else
    echo -e "${RED}✗${NC} gradle.properties is missing Kotlin version configuration"
    exit 1
fi

# Check build.gradle
echo "📄 Checking android/build.gradle..."
if grep -q "kotlinVersion.*2.0.21" android/build.gradle && \
   grep -q "kspVersion.*2.0.21-1.0.28" android/build.gradle && \
   grep -q "resolutionStrategy" android/build.gradle; then
    echo -e "${GREEN}✓${NC} build.gradle has correct Kotlin version and resolution strategy"
else
    echo -e "${RED}✗${NC} build.gradle is missing Kotlin version or resolution strategy"
    exit 1
fi

# Check settings.gradle
echo "📄 Checking android/settings.gradle..."
if grep -q "2.0.21" android/settings.gradle; then
    echo -e "${GREEN}✓${NC} settings.gradle has correct Kotlin version"
else
    echo -e "${YELLOW}⚠${NC} settings.gradle might not have Kotlin version set"
fi

# Check eas.json
echo "📄 Checking eas.json..."
if grep -q "EAS_SKIP_AUTO_FINGERPRINT" eas.json; then
    echo -e "${GREEN}✓${NC} eas.json has EAS_SKIP_AUTO_FINGERPRINT set"
else
    echo -e "${RED}✗${NC} eas.json is missing EAS_SKIP_AUTO_FINGERPRINT"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All Kotlin version configurations are correct!${NC}"
echo ""
echo "You can now build with:"
echo "  NODE_ENV=production npx expo export --platform android"
echo "  EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile production"
