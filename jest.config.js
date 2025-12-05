/**
 * Jest Configuration für k1w1-a0style
 * 
 * ✅ Expo-kompatibel
 * ✅ TypeScript Support
 * ✅ Coverage Tracking
 * ✅ Transform Ignore Patterns für React Native
 */

module.exports = {
  preset: 'jest-expo',
  
  // Test-Umgebung
  testEnvironment: 'node',
  
  // Setup-Dateien (werden vor jedem Test geladen)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Transform-Patterns (welche Dateien müssen transformiert werden)
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  
  // Module-Name-Mapping (für Aliases)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  
  // Coverage-Konfiguration
  collectCoverageFrom: [
    // Welche Dateien sollen in Coverage einbezogen werden
    'lib/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'screens/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    
    // Ausschlüsse
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/coverage/**',
  ],
  
  // Coverage-Thresholds (Tests schlagen fehl wenn Coverage zu niedrig)
  coverageThresholds: {
    global: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
    // Höhere Thresholds für kritische Module
    './lib/': {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
    './contexts/': {
      statements: 65,
      branches: 55,
      functions: 65,
      lines: 65,
    },
  },
  
  // Test-Pfade
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  
  // Coverage-Reporter
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
  ],
  
  // Coverage-Directory
  coverageDirectory: '<rootDir>/coverage',
  
  // Globals (für TypeScript)
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  
  // Module-Dateierweiterungen
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node',
  ],
  
  // Verbose Output
  verbose: true,
  
  // Test-Timeout (30 Sekunden)
  testTimeout: 30000,
  
  // Clear Mocks zwischen Tests
  clearMocks: true,
  
  // Restore Mocks zwischen Tests
  restoreMocks: true,
  
  // Reset Mocks zwischen Tests
  resetMocks: true,
};
