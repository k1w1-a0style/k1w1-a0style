// jest.config.mjs
// Jest-Konfiguration für Expo + React Native + Navigation + Reanimated

export default {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',

  // ESM-Module aus node_modules trotzdem durch Babel schicken
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native' +
      '|@react-native(-community)?' +
      '|@react-navigation' +
      '|expo(nent)?' +
      '|@expo(nent)?/.*' +
      '|react-native-reanimated' +
      '|react-native-gesture-handler' +
      '|react-native-safe-area-context' +
      '|react-native-screens' +
      ')',
  ],

  // Setup von react-native-gesture-handler (stellt interne Mocks bereit)
  setupFiles: [
    'react-native-gesture-handler/jestSetup',
  ],

  // Zusätzliche Jest-Setups (unsere Mocks + jest-native Matcher)
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '@testing-library/jest-native/extend-expect',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
