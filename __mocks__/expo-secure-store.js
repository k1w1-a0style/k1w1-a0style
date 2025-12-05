/**
 * Mock für expo-secure-store
 * 
 * Simuliert SecureStore für Tests
 */

let mockSecureStorage = {};

const SecureStore = {
  // Storage-Optionen (Konstanten)
  WHEN_UNLOCKED: 0,
  AFTER_FIRST_UNLOCK: 1,
  ALWAYS: 2,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 4,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 5,
  ALWAYS_THIS_DEVICE_ONLY: 6,

  setItemAsync: jest.fn((key, value, options) => {
    return new Promise((resolve, reject) => {
      if (!key || !value) {
        reject(new Error('Key and value are required'));
        return;
      }
      mockSecureStorage[key] = value;
      resolve();
    });
  }),

  getItemAsync: jest.fn((key, options) => {
    return new Promise((resolve) => {
      resolve(mockSecureStorage[key] || null);
    });
  }),

  deleteItemAsync: jest.fn((key, options) => {
    return new Promise((resolve) => {
      delete mockSecureStorage[key];
      resolve();
    });
  }),

  // Helper für Tests
  __getMockStorage: () => mockSecureStorage,
  __setMockStorage: (storage) => {
    mockSecureStorage = storage;
  },
  __resetMockStorage: () => {
    mockSecureStorage = {};
  },
};

export default SecureStore;
export const setItemAsync = SecureStore.setItemAsync;
export const getItemAsync = SecureStore.getItemAsync;
export const deleteItemAsync = SecureStore.deleteItemAsync;
export const WHEN_UNLOCKED = SecureStore.WHEN_UNLOCKED;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
export const ALWAYS_THIS_DEVICE_ONLY = SecureStore.ALWAYS_THIS_DEVICE_ONLY;
