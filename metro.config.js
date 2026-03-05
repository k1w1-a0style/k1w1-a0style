/**
 * Metro config for Expo (KiwiOS / CI-Lite)
 *
 * Goal: prevent Metro from ever trying to parse CI-lite env overlays (they are shell env files, not JS).
 * Important: we avoid importing Metro internals like "metro-config/src/defaults/exclusionList"
 * because newer Metro versions do not export that subpath (ERR_PACKAGE_PATH_NOT_EXPORTED).
 */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const ciLiteEnvOverlayRE = /[\\/](?:\.env\.ci-lite\.local)$/;

config.resolver = config.resolver || {};

// Metro historically used `blacklistRE`; newer versions prefer `blockList`.
const existing =
  config.resolver.blockList ||
  config.resolver.blacklistRE ||
  null;

if (existing instanceof RegExp) {
  // Combine without losing existing exclusions.
  config.resolver.blockList = new RegExp(
    `${existing.source}|${ciLiteEnvOverlayRE.source}`
  );
} else {
  config.resolver.blockList = ciLiteEnvOverlayRE;
}

// Keep things clean if older key was present.
if (config.resolver.blacklistRE) delete config.resolver.blacklistRE;

module.exports = config;
