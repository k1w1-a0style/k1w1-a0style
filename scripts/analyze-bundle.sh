#!/bin/bash

# Bundle Size Analysis Script
# Analyzes bundle size and provides optimization suggestions

echo "🔍 Analyzing Bundle Size..."
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "❌ node_modules not found. Run 'npm install' first."
  exit 1
fi

echo "📊 Checking package sizes..."
echo ""

# Analyze with depcheck (find unused dependencies)
echo "1️⃣ Unused Dependencies:"
npx depcheck --ignores="@types/*,eslint*,jest*,detox,@testing-library/*,babel-preset-expo,patch-package" || true

echo ""
echo "2️⃣ Largest Dependencies:"
npx -y du-cli -d 1 node_modules | sort -rh | head -20

echo ""
echo "3️⃣ React Native Bundle Analyzer (requires build):"
echo "   Run: npx react-native-bundle-visualizer"
echo ""

echo "4️⃣ Duplicate Package Check:"
npm ls --depth=0 2>&1 | grep "deduped" || echo "  No duplicates found ✅"

echo ""
echo "5️⃣ Recommendations:"
echo "  - Remove unused dependencies with: npm uninstall <package>"
echo "  - Update dependencies with: npm update"
echo "  - Check for lighter alternatives to large packages"
echo "  - Use import { specific } from 'package' instead of import * from 'package'"
echo ""

echo "✅ Analysis complete!"
