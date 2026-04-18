#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSqlFiles(dir) {
  return fs.readdirSync(dir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .map((entry) => path.join(dir, entry));
}

function extractLatestReturnsTableFunctions(sqlFiles) {
  const latestByFunction = new Map();
  const blockRe = /create\s+or\s+replace\s+function\s+public\.([a-zA-Z0-9_]+)\s*\([^)]*\)\s*returns\s+table\s*\(([^)]*)\)[\s\S]*?as\s+\$\$([\s\S]*?)\$\$\s*;/gi;

  for (const file of sqlFiles) {
    const sql = fs.readFileSync(file, "utf8");
    let match;
    while ((match = blockRe.exec(sql)) !== null) {
      const functionName = match[1];
      const returnsTableRaw = match[2];
      const body = match[3];
      const outputColumns = returnsTableRaw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.split(/\s+/)[0])
        .filter(Boolean);

      latestByFunction.set(functionName, {
        file: path.relative(repoRoot, file).replace(/\\/g, "/"),
        functionName,
        outputColumns,
        body,
      });
    }
  }

  return Array.from(latestByFunction.values());
}

function analyzeLatestReturnsTableFunctions(sqlFiles = getSqlFiles(migrationsDir)) {
  const functions = extractLatestReturnsTableFunctions(sqlFiles);
  const findings = [];

  for (const fn of functions) {
    for (const outputColumn of fn.outputColumns) {
      const suspiciousPredicate = new RegExp(
        String.raw`(?:^|\n)\s*(?:where|and|or)\s+${escapeRegex(outputColumn)}\b\s*(?:=|<>|!=|<|>|<=|>=|is\b|like\b|ilike\b|in\b)`,
        "gim",
      );

      let match;
      while ((match = suspiciousPredicate.exec(fn.body)) !== null) {
        findings.push({
          file: fn.file,
          functionName: fn.functionName,
          outputColumn,
          snippet: match[0].trim(),
        });
      }
    }
  }

  return findings;
}

if (require.main === module) {
  const findings = analyzeLatestReturnsTableFunctions();
  if (findings.length > 0) {
    console.error("[FAIL] Potential PL/pgSQL RETURNS TABLE ambiguity detected in latest function definitions:");
    for (const finding of findings) {
      console.error(`- ${finding.file} :: ${finding.functionName} :: output '${finding.outputColumn}' appears unqualified in predicate -> ${finding.snippet}`);
    }
    process.exit(1);
  }

  console.log("PL/pgSQL RETURNS TABLE ambiguity guard passed.");
}

module.exports = {
  analyzeLatestReturnsTableFunctions,
  extractLatestReturnsTableFunctions,
};