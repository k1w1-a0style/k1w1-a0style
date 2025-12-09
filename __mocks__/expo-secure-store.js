let mockSecureStorage = {};

const SecureStore = {
  // Optional: konstante Werte (schaden nicht)
  WHEN_UNLOCKED: 0,
  AFTER_FIRST_UNLOCK: 1,
  ALWAYS: 2,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 4,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 5,
  ALWAYS_THIS_DEVICE_ONLY: 6,

  setItemAsync: jest.fn(async (key, value) => {
    if (!key) throw new Error('Key is required');
    mockSecureStorage[key] = String(value);
  }),

  getItemAsync: jest.fn(async (key) => {
    if (!key) return null;
    return mockSecureStorage[key] ?? null;
  }),

  deleteItemAsync: jest.fn(async (key) => {
    if (!key) return;
    delete mockSecureStorage[key];
  }),

  // ✅ Helpers für deine Smoke-Tests
  __getMockStorage: () => mockSecureStorage,
  __setMockStorage: (storage) => {
    mockSecureStorage = storage || {};
  },
  __resetMockStorage: () => {
    mockSecureStorage = {};
  },
};

module.exports = SecureStore;
module.exports.default = SecureStore;
