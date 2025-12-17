/* eslint-env jest */
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

jest.mock(
  'react-native/Libraries/Animated/NativeAnimatedHelper',
  () => ({}),
  { virtual: true }
);

// Wichtig: Kein Factory-Require, damit __mocks__/expo-secure-store.js genutzt wird
jest.mock('expo-secure-store');

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

// 🔥 Neu: react-native-webview in Tests immer mocken
jest.mock('react-native-webview');
