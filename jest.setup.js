/**
 * Jest Setup - Wird vor jedem Test geladen
 * 
 * Minimale Setup-Datei für Unit Tests
 */

// ============================================
// CONSOLE MOCKING
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
// GLOBAL TEST UTILITIES
// ============================================

// Timing helper für async Tests
global.flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// Delay helper
global.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================
// BUFFER POLYFILL
// ============================================

// Buffer für Node.js
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

// ============================================
// TEXT ENCODER/DECODER POLYFILL
// ============================================

// TextEncoder/TextDecoder für Node < 18
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// btoa/atob Polyfill für SecureTokenManager
if (typeof btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}

if (typeof atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

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
