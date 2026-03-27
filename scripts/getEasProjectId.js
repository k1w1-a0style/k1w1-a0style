#!/usr/bin/env node
/**
 * Prints the EAS projectId from eas-project.json.
 * Exits non-zero if missing/invalid.
 */
const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const p = path.join(process.cwd(), "eas-project.json");
if (!fs.existsSync(p)) fail("eas-project.json not found at repo root");

let j;
try {
  j = JSON.parse(fs.readFileSync(p, "utf8"));
} catch (_e) {
  fail("eas-project.json is not valid JSON");
}

if (!j || typeof j.projectId !== "string" || !j.projectId.trim()) {
  fail("eas-project.json missing projectId");
}

process.stdout.write(j.projectId.trim());
