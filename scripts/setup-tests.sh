#!/bin/bash

###############################################################################
# Test Setup Script für k1w1-a0style
#
# Installiert alle Test-Dependencies und führt ersten Test aus
###############################################################################

set -e  # Exit bei Fehler

echo "🚀 k1w1-a0style Test Setup"
echo "=============================="
echo ""

# Check Node Version
echo "📦 Checking Node version..."
NODE_VERSION=$(node --version)
echo "   Node: $NODE_VERSION"

if [[ ! "$NODE_VERSION" =~ ^v20 ]] && [[ ! "$NODE_VERSION" =~ ^v21 ]]; then
  echo "⚠️  WARNING: Node 20+ recommended, you have $NODE_VERSION"
fi

echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""

# Install test dependencies (falls noch nicht installiert)
echo "🧪 Installing test dependencies..."
npm install --save-dev \
  @testing-library/react-native@^12.4.0 \
  @testing-library/jest-native@^5.4.3 \
  jest@^29.7.0 \
  jest-expo@^50.0.1 \
  ts-jest@^29.1.1 \
  @types/jest@^29.5.11 \
  react-test-renderer@18.3.1

echo ""

# Clear Jest cache
echo "🧹 Clearing Jest cache..."
npm run test:clear || true

echo ""

# Run smoke test
echo "🧪 Running smoke test..."
npm test -- __tests__/smoke.test.ts

echo ""
echo "✅ Test setup complete!"
echo ""
echo "Available test commands:"
echo "  npm test              - Run all tests"
echo "  npm run test:watch    - Run tests in watch mode"
echo "  npm run test:coverage - Run tests with coverage"
echo "  npm run test:verbose  - Run tests with verbose output"
echo ""
echo "📚 See TESTING_GUIDE.md for more information"
echo ""
