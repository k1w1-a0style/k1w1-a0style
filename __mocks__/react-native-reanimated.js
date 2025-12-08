// __mocks__/react-native-reanimated.js
// Einfacher Jest-Mock für react-native-reanimated

const Reanimated = require('react-native-reanimated/mock');

// Default-Export setzen
Reanimated.default = Reanimated;

// Worklet-Flag neutralisieren
Reanimated.isReanimated = false;

// Evtl. Layout-Anims deaktivieren (falls genutzt)
Reanimated.Layout = {
  ...Reanimated.Layout,
  animations: {},
  config: {},
};

module.exports = Reanimated;
