#!/usr/bin/env node
/**
 * Fails if any `uses:` reference in .github/workflows/*.yml is NOT pinned to a full 40-char commit SHA.
 *
 * Allowed:
 *   uses: owner/repo@<40-hex>
 *   - uses: owner/repo@<40-hex>
 *
 * Disallowed:
 *   uses: owner/repo@v4
 *   uses: owner/repo@main
 *
 * Ignored (no pinning requirement):
 *   uses: docker://...
 *   uses: ./local-action
 */

import fs from "fs";
import path from "path";

const WORKFLOWS_DIR = path.join(process.cwd(), ".github", "workflows");

function listWorkflowFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((f) => path.join(dir, f));
}

const shaRe = /^[0-9a-f]{40}$/i;

function checkFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*(?:-\s*)?uses:\s*["']?([^"'\s#]+)["']?\s*(?:#.*)?$/);
    if (!m) continue;

    const ref = m[1];

    // Skip local actions and docker actions (policy: we only enforce pinning for remote marketplace actions)
    if (ref.startsWith("./") || ref.startsWith("docker://")) continue;

    const at = ref.lastIndexOf("@");
    if (at === -1) {
      issues.push({
        line: i + 1,
        ref,
        reason: "missing @<ref>",
      });
      continue;
    }

    const pinned = ref.slice(at + 1);
    if (!shaRe.test(pinned)) {
      issues.push({
        line: i + 1,
        ref,
        reason: "not pinned to 40-char SHA",
      });
    }
  }

  return issues;
}

const files = listWorkflowFiles(WORKFLOWS_DIR);
if (!files.length) {
  process.stdout.write("No workflow files found.\n");
  process.exit(0);
}

let totalIssues = 0;
for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const issues = checkFile(file);
  if (!issues.length) continue;

  totalIssues += issues.length;
  console.error(`\n${rel}`);
  for (const it of issues) {
    console.error(`  L${it.line}: ${it.ref}  -> ${it.reason}`);
  }
}

if (totalIssues) {
  console.error(`\nFAIL: ${totalIssues} action reference(s) not pinned to full SHAs.`);
  process.exit(1);
}

process.stdout.write("OK: all remote actions are pinned to full SHAs.\n");
