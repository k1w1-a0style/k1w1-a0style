// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Wir behalten die Watcher-Anpassung (für ENOSPC), aber entfernen die blockList
config.watchFolders = config.watchFolders ?? [];
config.watcher = config.watcher ?? {};
config.watcher.additionalExts = config.watcher.additionalExts ?? [];

module.exports = config;
