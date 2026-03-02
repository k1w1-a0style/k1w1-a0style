#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

function collectMarkdownLinks(text) {
  const links = [];
  const re = /\[[^\]]+\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    links.push(m[1]);
  }
  return links;
}

function normalizeDocLink(target, baseFile) {
  if (!target || target.startsWith('http') || target.startsWith('#')) return null;
  const clean = target.split('#')[0];
  if (!clean) return null;
  return path.normalize(path.join(path.dirname(baseFile), clean)).replace(/\\/g, '/');
}

const errors = [];

// 1) docs/INDEX.md linked files exist
const indexFile = 'docs/INDEX.md';
const indexText = read(indexFile);
for (const link of collectMarkdownLinks(indexText)) {
  const rel = normalizeDocLink(link, indexFile);
  if (!rel) continue;
  if (!exists(rel)) {
    errors.push(`[INDEX] Missing target: ${link} (resolved: ${rel})`);
  }
}

// 2) Patchlog links exist
const patchlogFile = 'docs/patches/PATCHLOG_ROOT.md';
const patchlogText = read(patchlogFile);
const patchLinkRe = /docs\/patches\/[A-Za-z0-9_.-]+\.md/g;
const patchLinks = patchlogText.match(patchLinkRe) || [];
for (const rel of Array.from(new Set(patchLinks))) {
  if (!exists(rel)) {
    errors.push(`[PATCHLOG] Missing linked patch file: ${rel}`);
  }
}

// 3) Optional: check IDs in docs/07 exist in diagnostics code
const playbookFile = 'docs/07-diagnostics-fix-playbook.md';
if (exists(playbookFile)) {
  const playbook = read(playbookFile);
  const idMatches = playbook.match(/`([a-z][a-z0-9_.-]+)`/g) || [];
  const allowedPrefixes = ['local.', 'repo.', 'security-', 'workflow-', 'assets-', 'lockfile-', 'gitignore-', 'native-', 'eas-', 'core-', 'entry-', 'expo-', 'rn-', 'quality-'];
  const ids = Array.from(new Set(idMatches.map((s) => s.slice(1, -1)).filter((s) => allowedPrefixes.some((p) => s.slice(1, -1).startsWith(p)))));

  const diagDir = path.join(repoRoot, 'lib', 'diagnostics');
  let diagCorpus = '';
  const stack = [diagDir];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || !fs.existsSync(cur)) continue;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(ts|tsx|js)$/.test(entry.name)) {
        diagCorpus += '\n' + fs.readFileSync(full, 'utf8');
      }
    }
  }

  for (const id of ids) {
    if (!diagCorpus.includes(id)) {
      // soft check: only warn-like error text for likely check ids
      errors.push(`[CHECK-ID] Not found in lib/diagnostics corpus: ${id}`);
    }
  }
}

if (errors.length) {
  console.error('docsLint found issues:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log('docsLint: OK');
