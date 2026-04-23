/* global __dirname */
const fs = require("fs");
const path = require("path");

const EAS_PROJECT_ID_SENTINELS = new Set([
  "00000000-0000-4000-8000-000000000000",
  "<your-project-id>",
  "<your-eas-project-id>",
  "__unlinked_eas_project_id__",
]);

const EAS_PROJECT_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidLinkedEasProjectId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return false;
  if (EAS_PROJECT_ID_SENTINELS.has(normalized.toLowerCase())) return false;
  return EAS_PROJECT_ID_REGEX.test(normalized);
}

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

  if (isValidLinkedEasProjectId(fromEnv)) return fromEnv.trim();

  const fromFile = readEasProjectIdFromFile();
  if (isValidLinkedEasProjectId(fromFile)) return fromFile.trim();

  const existing = config?.extra?.eas?.projectId;
  if (isValidLinkedEasProjectId(existing)) return existing.trim();

  return undefined;
}

module.exports = ({ config }) => {
  const projectId = pickProjectId(config);

  if (!projectId) {
    throw new Error(
      "expo.extra.eas.projectId missing or invalid. Fix: run EAS linking and commit eas-project.json " +
        "with a real UUID projectId, or set EAS_PROJECT_ID / EXPO_PUBLIC_EAS_PROJECT_ID to a real linked UUID."
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
