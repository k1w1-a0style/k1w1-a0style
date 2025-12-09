// jest.config.js
module.exports = {
  preset: 'jest-expo',

  testMatch: [
    '<rootDir>/__tests__/**/*.test.(ts|tsx|js|jsx)',
    '<rootDir>/lib/__tests__/**/*.test.(ts|tsx|js|jsx)',
  ],

  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
  ],

  // WICHTIG: Expo-Module + expo-modules-core müssen transpiled werden
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native' +
      '|@react-native' +
      '|@react-navigation' +
      '|expo(nent)?' +
      '|@expo(nent)?/.*' +
      '|expo-modules-core' +
      '|react-native-reanimated' +
      '|react-native-gesture-handler' +
      '|react-native-screens' +
      '|react-native-safe-area-context' +
      '|@unimodules' +
      '|unimodules' +
      ')',
  ],
};
