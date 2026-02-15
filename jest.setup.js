/* eslint-env jest */
import "react-native-gesture-handler/jestSetup";
import { cleanup } from "@testing-library/react-native";

jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({}), {
  virtual: true,
});

// Wichtig: Kein Factory-Require, damit __mocks__/expo-secure-store.js genutzt wird
jest.mock("expo-secure-store");

jest.mock("uuid", () => ({ v4: () => "test-uuid" }));

// 🔥 react-native-webview in Tests immer mocken
jest.mock("react-native-webview");

// ✅ Fix: expo-notifications side effects in Jest verhindern (Worker-Leaks / Warnspam)
jest.mock("expo-notifications", () => ({
  // permissions
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),

  // token
  getExpoPushTokenAsync: jest.fn(async () => ({
    data: "ExponentPushToken[test-token]",
  })),

  // handler / channels
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => ({})),

  // scheduling / clearing
  scheduleNotificationAsync: jest.fn(async () => "notification-id"),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
  // listeners: wichtig => Rückgabeobjekt mit remove()
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  removeNotificationSubscription: jest.fn(),

  // constants
  AndroidImportance: { MAX: 5 },
}));


// ✅ Global teardown to prevent Jest worker leaks (timers / listeners)
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
