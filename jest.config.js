/**
 * Jest Configuration für k1w1-a0style
 * 
 * ✅ TypeScript Support
 * ✅ Coverage Tracking
 * ✅ Node Environment (keine React Native mocks nötig)
 */

module.exports = {
  // Kein preset - wir konfigurieren alles manuell für bessere Kontrolle
  
  // Test-Umgebung
  testEnvironment: 'node',
  
  // Setup-Dateien (werden vor jedem Test geladen)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // TypeScript Transform
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  
  // Transform-Patterns (welche Dateien NICHT transformiert werden)
  transformIgnorePatterns: [
    'node_modules/(?!(zod)/)',
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
  
  // Coverage-Thresholds (werden schrittweise erhöht)
  // AKTUELL: Woche 1 - Foundation (3%)
  // ZIEL: Woche 7 - Production (80%)
  coverageThreshold: {
    // Global Thresholds (niedrig für Start, wird erhöht)
    global: {
      statements: 0, // Start: 0%, Ziel: 60%
      branches: 0,   // Start: 0%, Ziel: 50%
      functions: 0,  // Start: 0%, Ziel: 60%
      lines: 0,      // Start: 0%, Ziel: 60%
    },
    // Kritische Module: Höhere Standards
    './lib/SecureKeyManager.ts': {
      statements: 90,
      branches: 90,
      functions: 100,
      lines: 90,
    },
    './lib/validators.ts': {
      statements: 90,
      branches: 80,
      functions: 100,
      lines: 90,
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
