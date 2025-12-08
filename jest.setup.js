// jest.setup.js
// Zentrales Jest-Setup für Reanimated, Gesture-Handler, Expo + AsyncStorage + uuid

// ---------------------------------------------------------
// 0) uuid mocken (ESM-Export-Probleme in Jest vermeiden)
// ---------------------------------------------------------
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-0000-0000-0000-000000000000',
}));

// ---------------------------------------------------------
// 1) AsyncStorage mocken (sonst: NativeModule is null)
// ---------------------------------------------------------
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ---------------------------------------------------------
// 1.1) react-native-zip-archive mocken
//     (NativeEventEmitter crash vermeiden)
// ---------------------------------------------------------
jest.mock('react-native-zip-archive', () => ({
  zip: jest.fn().mockResolvedValue('mock://zip-result.zip'),
  unzip: jest.fn().mockResolvedValue('mock://unzip-result'),
}));

// ---------------------------------------------------------
// 2) react-native-reanimated mocken
// ---------------------------------------------------------
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  Reanimated.default = Reanimated;

  // Wichtig für gesture-handler / drawer
  Reanimated.createAnimatedComponent = (Component) => Component;

  Reanimated.useSharedValue = jest.fn((initial) => ({ value: initial }));
  Reanimated.useAnimatedStyle = jest.fn((fn) => fn());
  Reanimated.withTiming = jest.fn((v) => v);
  Reanimated.withSpring = jest.fn((v) => v);
  Reanimated.withDelay = jest.fn((_, cb) => cb());

  return Reanimated;
});

// ---------------------------------------------------------
// 3) Gesture-Handler – vereinfachtes Mocking
// ---------------------------------------------------------
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');

  return {
    ...actual,
    GestureHandlerRootView: ({ children }) => children,
  };
});

// ---------------------------------------------------------
// 4) Expo Asset / Font / Vector Icons Mocks
//    expo-asset ist offenbar nicht installiert -> virtual.
// ---------------------------------------------------------
jest.mock(
  'expo-asset',
  () => ({
    Asset: {
      fromModule: jest.fn(() => ({
        downloadAsync: jest.fn(),
        uri: 'mock://asset',
      })),
    },
  }),
  { virtual: true }
);

jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(true),
  isLoaded: jest.fn(() => true),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockIcon = ({ name = 'icon', testID, ...props }) =>
    React.createElement(
      Text,
      { testID: testID ?? `icon-${name}`, ...props },
      name
    );

  return {
    Ionicons: MockIcon,
    AntDesign: MockIcon,
    MaterialIcons: MockIcon,
    FontAwesome: MockIcon,
    Feather: MockIcon,
  };
});


// 5) react-native-webview mock (TurboModule error fix)
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = (props) => React.createElement(View, { ...props, testID: props?.testID ?? 'mock-webview' });
  return { WebView, default: WebView };
});
