/* eslint-env jest */
/**
 * Mock für @react-native-async-storage/async-storage
 * 
 * Simuliert AsyncStorage für Tests
 */

let mockStorage = {};

const AsyncStorage = {
  setItem: jest.fn((key, value) => {
    return new Promise((resolve) => {
      mockStorage[key] = value;
      resolve(null);
    });
  }),

  getItem: jest.fn((key) => {
    return new Promise((resolve) => {
      resolve(mockStorage[key] || null);
    });
  }),

  removeItem: jest.fn((key) => {
    return new Promise((resolve) => {
      delete mockStorage[key];
      resolve(null);
    });
  }),

  clear: jest.fn(() => {
    return new Promise((resolve) => {
      mockStorage = {};
      resolve(null);
    });
  }),

  getAllKeys: jest.fn(() => {
    return new Promise((resolve) => {
      resolve(Object.keys(mockStorage));
    });
  }),

  multiGet: jest.fn((keys) => {
    return new Promise((resolve) => {
      const values = keys.map((key) => [key, mockStorage[key] || null]);
      resolve(values);
    });
  }),

  multiSet: jest.fn((keyValuePairs) => {
    return new Promise((resolve) => {
      keyValuePairs.forEach(([key, value]) => {
        mockStorage[key] = value;
      });
      resolve(null);
    });
  }),

  multiRemove: jest.fn((keys) => {
    return new Promise((resolve) => {
      keys.forEach((key) => {
        delete mockStorage[key];
      });
      resolve(null);
    });
  }),

  // Helper für Tests
  __getMockStorage: () => mockStorage,
  __setMockStorage: (storage) => {
    mockStorage = storage;
  },
  __resetMockStorage: () => {
    mockStorage = {};
  },
};

module.exports = AsyncStorage;
