#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function readText(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function parseFunctionConfigToml(text) {
  const repo = {};
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^\[functions\.([^\]]+)\]$/);
    if (sectionMatch) {
      current = sectionMatch[1];
      repo[current] = {};
      continue;
    }
    if (!current) continue;
    if (line.startsWith("enabled = ")) {
      repo[current].enabled = line.split("=", 2)[1].trim() === "true";
    }
    if (line.startsWith("verify_jwt = ")) {
      repo[current].verify_jwt = line.split("=", 2)[1].trim() === "true";
    }
  }

  return repo;
}

function deriveProjectRef({ projectRef, edgeBaseUrl }) {
  const direct = String(projectRef || "").trim();
  if (direct) return direct;

  const fromEdge = String(edgeBaseUrl || "").trim();
  if (!fromEdge) {
    fail("Missing SUPABASE_PROJECT_REF (or EDGE_BASE_URL for auto-derive).");
  }

  const match = fromEdge.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/functions\/v1/i);
  if (!match) {
    fail("Could not derive project ref from EDGE_BASE_URL.");
  }
  return match[1];
}

function classifyFunctionDrift(repoConfig, liveFunctions) {
  const liveBySlug = Object.fromEntries(
    (Array.isArray(liveFunctions) ? liveFunctions : []).map((item) => [item.slug, item]),
  );
  const allNames = Array.from(new Set([...Object.keys(repoConfig), ...Object.keys(liveBySlug)])).sort();

  const drift = [];
  for (const slug of allNames) {
    const repo = repoConfig[slug] || null;
    const live = liveBySlug[slug] || null;

    if (!repo && live) {
      drift.push({ slug, severity: "warn", issue: "live_only", live });
      continue;
    }
    if (repo && !live) {
      if (repo.enabled === false) {
        continue;
      }
      drift.push({ slug, severity: "warn", issue: "repo_only", repo });
      continue;
    }
    if (!repo || !live) continue;

    if (repo.verify_jwt !== live.verify_jwt) {
      drift.push({
        slug,
        severity: repo.verify_jwt ? "critical" : "warn",
        issue: "verify_jwt_drift",
        repo_verify_jwt: repo.verify_jwt,
        live_verify_jwt: live.verify_jwt,
        live_status: live.status,
      });
    }

    if (repo.enabled === false && live.status === "ACTIVE") {
      drift.push({
        slug,
        severity: "critical",
        issue: "disabled_in_repo_but_active_live",
        repo_enabled: repo.enabled,
        live_status: live.status,
        live_verify_jwt: live.verify_jwt,
      });
    }
  }

  return drift;
}

function extractPublicTables(databaseContext) {
  const databases = Array.isArray(databaseContext?.databases) ? databaseContext.databases : [];
  for (const db of databases) {
    const schemas = Array.isArray(db?.schemas) ? db.schemas : [];
    for (const schema of schemas) {
      if (schema?.name !== "public") continue;
      const tables = Array.isArray(schema?.tables) ? schema.tables : [];
      return tables
        .map((table) => String(table?.name || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
  }
  return [];
}

async function fetchManagementJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    fail(`Management API failed (${response.status}) for ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

function printSummary(summary) {
  const lines = [];
  lines.push(`Project: ${summary.project.ref} (${summary.project.status})`);
  lines.push(`Region: ${summary.project.region} | Postgres: ${summary.project.database?.version || "unknown"}`);
  lines.push(`Live Functions: ${summary.liveFunctions.length}`);
  lines.push(`Public Tables (${summary.publicTables.length}): ${summary.publicTables.join(", ") || "none"}`);
  lines.push(`Security Advisors: ${summary.securityLints.length}`);
  lines.push(`Performance Advisors: ${summary.performanceLints.length}`);

  if (summary.securityLints.length) {
    lines.push("Security Findings:");
    for (const lint of summary.securityLints) {
      lines.push(`- [${lint.level}] ${lint.title}: ${lint.detail}`);
    }
  }

  if (summary.performanceLints.length) {
    lines.push("Performance Findings:");
    for (const lint of summary.performanceLints) {
      lines.push(`- [${lint.level}] ${lint.detail}`);
    }
  }

  if (summary.drift.length) {
    lines.push("Function Drift:");
    for (const item of summary.drift) {
      lines.push(`- [${item.severity}] ${item.slug}: ${item.issue}`);
    }
  } else {
    lines.push("Function Drift: none");
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

async function run() {
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    fail("Missing SUPABASE_ACCESS_TOKEN.");
  }

  const projectRef = deriveProjectRef({
    projectRef: process.env.SUPABASE_PROJECT_REF,
    edgeBaseUrl: process.env.EDGE_BASE_URL,
  });

  const repoConfig = parseFunctionConfigToml(readText("supabase/config.toml"));
  const baseUrl = `https://api.supabase.com/v1/projects/${projectRef}`;

  const [project, liveFunctions, securityAdvisors, performanceAdvisors, databaseContext] = await Promise.all([
    fetchManagementJson(baseUrl, token),
    fetchManagementJson(`${baseUrl}/functions`, token),
    fetchManagementJson(`${baseUrl}/advisors/security`, token),
    fetchManagementJson(`${baseUrl}/advisors/performance`, token),
    fetchManagementJson(`${baseUrl}/database/context`, token),
  ]);

  const summary = {
    project,
    liveFunctions,
    securityLints: Array.isArray(securityAdvisors?.lints) ? securityAdvisors.lints : [],
    performanceLints: Array.isArray(performanceAdvisors?.lints) ? performanceAdvisors.lints : [],
    publicTables: extractPublicTables(databaseContext),
    drift: classifyFunctionDrift(repoConfig, liveFunctions),
  };

  printSummary(summary);

  const hasCriticalDrift = summary.drift.some((item) => item.severity === "critical");
  if (hasCriticalDrift) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

module.exports = {
  classifyFunctionDrift,
  deriveProjectRef,
  extractPublicTables,
  parseFunctionConfigToml,
};