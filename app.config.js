/* global __dirname */
const fs = require("fs");
const path = require("path");

/**
 * Deterministically derive EAS projectId for Expo config.
 * Priority:
 *  1) EAS_PROJECT_ID / EXPO_PUBLIC_EAS_PROJECT_ID env (CI-safe)
 *  2) ./eas-project.json at repo root (local + CI)
 *  3) existing config.extra.eas.projectId (if already present)
 *
 * If we still can't find a projectId, we throw with a clear error.
 */
function readEasProjectIdFromFile() {
  try {
    const p = path.join(__dirname, "eas-project.json");
    if (!fs.existsSync(p)) return undefined;
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw);
    return typeof j?.projectId === "string" ? j.projectId : undefined;
  } catch {
    return undefined;
  }
}

function pickProjectId(config) {
  const fromEnv =
    process.env.EAS_PROJECT_ID ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    process.env.EXPO_PUBLIC_PROJECT_ID;

  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();

  const fromFile = readEasProjectIdFromFile();
  if (typeof fromFile === "string" && fromFile.trim()) return fromFile.trim();

  const existing = config?.extra?.eas?.projectId;
  if (typeof existing === "string" && existing.trim()) return existing.trim();

  return undefined;
}

module.exports = ({ config }) => {
  const projectId = pickProjectId(config);

  if (!projectId) {
    throw new Error(
      "expo.extra.eas.projectId missing. Fix: commit eas-project.json (with projectId) " +
        "or set EAS_PROJECT_ID / EXPO_PUBLIC_EAS_PROJECT_ID in the environment."
    );
  }

  const extra = config?.extra ?? {};
  const eas = extra?.eas ?? {};

  return {
    ...config,
    extra: {
      ...extra,
      eas: {
        ...eas,
        projectId,
      },
    },
  };
};
