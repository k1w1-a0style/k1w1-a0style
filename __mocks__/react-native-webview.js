// __mocks__/react-native-webview.js
const React = require('react');
const { View } = require('react-native');

function WebView(props) {
  return React.createElement(View, props);
}

module.exports = {
  WebView,
  default: WebView,
};
