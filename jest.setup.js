/* eslint-env jest */
import "react-native-gesture-handler/jestSetup";
import { cleanup } from "@testing-library/react-native";

// Increase Jest timeout to reduce flakiness in slower CI / RN tests
jest.setTimeout(20000);

jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({}), {
  virtual: true,
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name, children, ...props }) => (
    <Text {...props}>{children ?? String(name ?? "icon")}</Text>
  );

  return {
    Ionicons: Icon,
  };
});

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return ({ name, children, ...props }) => (
    <Text {...props}>{children ?? String(name ?? "icon")}</Text>
  );
});

// Wichtig: Kein Factory-Require, damit __mocks__/expo-secure-store.js genutzt wird
jest.mock("expo-secure-store");

jest.mock("uuid", () => ({ v4: () => "test-uuid" }));
jest.mock(
  "libsodium-wrappers-sumo",
  () => ({
    __esModule: true,
    ready: Promise.resolve(),
    crypto_box_seal: jest.fn((message) => message),
    default: {
      ready: Promise.resolve(),
      crypto_box_seal: jest.fn((message) => message),
    },
  }),
  { virtual: true },
);

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

const originalFetch = global.fetch;
const originalXMLHttpRequest = global.XMLHttpRequest;
const originalWebSocket = global.WebSocket;

const blockNetworkFactory = (apiName) => () => {
  throw new Error(
    `Unexpected real network call via ${apiName}. Mock the API in this test explicitly.`,
  );
};

const BlockedXMLHttpRequest = class BlockedXMLHttpRequest {
  constructor() {
    throw new Error(
      "Unexpected real network call via XMLHttpRequest. Mock the API in this test explicitly.",
    );
  }
};

const BlockedWebSocket = class BlockedWebSocket {
  constructor() {
    throw new Error(
      "Unexpected real network call via WebSocket. Mock the API in this test explicitly.",
    );
  }
};

const resetBlockedNetworkGlobals = () => {
  global.fetch = jest.fn(blockNetworkFactory("fetch"));
  global.XMLHttpRequest = BlockedXMLHttpRequest;
  global.WebSocket = BlockedWebSocket;
};

const unhandledRejectionErrors = [];

const LISTENER_REF_KEY = "__k1w1UnhandledRejectionListenerRefCount";


const onUnhandledRejection = (reason) => {
  if (reason instanceof Error) {
    unhandledRejectionErrors.push(reason);
    return;
  }

  unhandledRejectionErrors.push(new Error(`Unhandled promise rejection: ${String(reason)}`));
};

beforeAll(() => {
  const currentRefs = globalThis[LISTENER_REF_KEY] ?? 0;
  if (currentRefs === 0) {
    process.on("unhandledRejection", onUnhandledRejection);
  }
  globalThis[LISTENER_REF_KEY] = currentRefs + 1;
});

beforeEach(() => {
  unhandledRejectionErrors.length = 0;
  resetBlockedNetworkGlobals();
});

// ✅ Global teardown to prevent Jest worker leaks (timers / listeners / DOM / async leftovers)
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
  resetBlockedNetworkGlobals();

  if (unhandledRejectionErrors.length === 1) {
    const [error] = unhandledRejectionErrors.splice(0, 1);
    throw error;
  }

  if (unhandledRejectionErrors.length > 1) {
    const errors = unhandledRejectionErrors.splice(0, unhandledRejectionErrors.length);
    throw new AggregateError(errors, "Unhandled promise rejections occurred during this test.");
  }
});

afterAll(() => {
  const currentRefs = globalThis[LISTENER_REF_KEY] ?? 0;
  const nextRefs = Math.max(0, currentRefs - 1);
  globalThis[LISTENER_REF_KEY] = nextRefs;
  if (nextRefs === 0) {
    process.off("unhandledRejection", onUnhandledRejection);
  }

  jest.clearAllTimers();
  jest.useRealTimers();
  global.fetch = originalFetch;
  global.XMLHttpRequest = originalXMLHttpRequest;
  global.WebSocket = originalWebSocket;
});
