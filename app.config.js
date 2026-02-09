/* global __dirname */
/**
 * app.config.js
 *
 * Goal: ensure expo.extra.eas.projectId is set deterministically (CI + local).
 * Source of truth:
 *  1) ./eas-project.json (committed)
 *  2) env: EAS_PROJECT_ID / EXPO_PUBLIC_EAS_PROJECT_ID
 */
const fs = require("fs");
const path = require("path");

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function getEasProjectId() {
  // Prefer repo-root eas-project.json (same dir as this file)
  try {
    const p = path.join(__dirname, "eas-project.json");
    if (fs.existsSync(p)) {
      const j = readJson(p);
      if (j && typeof j.projectId === "string" && j.projectId.trim()) return j.projectId.trim();
    }
  } catch {
    // ignore
  }

  // Fallback: CI/env
  const envId = process.env.EAS_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (typeof envId === "string" && envId.trim()) return envId.trim();

  return undefined;
}

module.exports = ({ config }) => {
  const projectId = getEasProjectId();

  // Preserve existing extra fields
  const extra = { ...(config.extra || {}) };
  const easExtra = { ...(extra.eas || {}) };

  if (projectId) easExtra.projectId = projectId;

  extra.eas = easExtra;

  return {
    ...config,
    extra,
  };
};
