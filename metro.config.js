// Learn more https://docs.expo.dev/guides/customizing-metro
//
// ✅ Node 18 compatibility shim
// Some versions of metro/metro-config use the newer Array "copy" methods
// (toReversed/toSorted/toSpliced). Those exist in Node 20+, but not in Node 18.
// This tiny polyfill keeps local `npx expo start` working without touching node_modules.
/* eslint-disable no-extend-native */
if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value: function toReversed() {
      return Array.from(this).reverse();
    },
    writable: true,
    configurable: true,
  });
}

if (!Array.prototype.toSorted) {
  Object.defineProperty(Array.prototype, 'toSorted', {
    value: function toSorted(compareFn) {
      return Array.from(this).sort(compareFn);
    },
    writable: true,
    configurable: true,
  });
}

if (!Array.prototype.toSpliced) {
  Object.defineProperty(Array.prototype, 'toSpliced', {
    value: function toSpliced(start, deleteCount, ...items) {
      const copy = Array.from(this);
      copy.splice(start, deleteCount, ...items);
      return copy;
    },
    writable: true,
    configurable: true,
  });
}
/* eslint-enable no-extend-native */

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
