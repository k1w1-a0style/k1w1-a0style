/**
 * Jest Setup - Wird vor jedem Test geladen
 * 
 * Hier werden globale Mocks und Test-Utilities konfiguriert
 */

// ============================================
// REACT NATIVE MOCKS
// ============================================

// Mock console methods für saubere Test-Ausgabe
global.console = {
  ...console,
  // Unterdrücke log/debug in Tests (außer wenn VERBOSE=true)
  log: process.env.VERBOSE === 'true' ? console.log : jest.fn(),
  debug: jest.fn(),
  // Behalte wichtige Ausgaben
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// ============================================
// REACT NATIVE COMPONENTS
// ============================================

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock Clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve('')),
}));

// ============================================
// EXPO MOCKS
// ============================================

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    deviceId: 'test-device-id-12345',
    manifest: {},
    expoConfig: {},
  },
}));

// Mock expo-crypto (wird für SecureTokenManager benötigt)
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn((algorithm, data) => 
    Promise.resolve('mocked-hash-' + data.substring(0, 10))
  ),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  getRandomBytesAsync: jest.fn((length) => 
    Promise.resolve(new Uint8Array(length))
  ),
}));

// ============================================
// GLOBAL TEST UTILITIES
// ============================================

// Timing helper für async Tests
global.flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// Delay helper
global.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================
// CLEANUP
// ============================================

// Cleanup nach jedem Test
afterEach(() => {
  jest.clearAllTimers();
});

// ============================================
// SETUP COMPLETE
// ============================================

console.info('✅ Jest Setup komplett geladen');
