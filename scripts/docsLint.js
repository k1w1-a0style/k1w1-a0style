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


// 2b) Every markdown file must keep local markdown links resolvable.
function collectMarkdownFiles(dir, bucket = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectMarkdownFiles(full, bucket);
    else if (/\.mdx?$/i.test(entry.name)) bucket.push(path.relative(repoRoot, full).replace(/\\/g, '/'));
  }
  return bucket;
}
for (const file of collectMarkdownFiles(repoRoot)) {
  const body = read(file);
  for (const link of collectMarkdownLinks(body)) {
    const rel = normalizeDocLink(link, file);
    if (!rel) continue;
    if (!exists(rel)) {
      errors.push(`[MD-LINK] Missing target in ${file}: ${link} (resolved: ${rel})`);
    }
  }
}

// 3) Root-vs-docs reference drift in agent/bootstrap docs
const requiredInlineRefs = [
  ['AI_START_HERE.md', ['docs/PROJECT_CONTEXT.md', 'docs/SYSTEM_README.md', 'docs/codex/PROMPT_DE.md']],
  ['AGENTS.md', ['docs/PROJECT_CONTEXT.md', 'docs/SYSTEM_README.md']],
  ['docs/codex/PROMPT_DE.md', ['docs/PROJECT_CONTEXT.md', 'docs/SYSTEM_README.md']],
];

for (const [file, refs] of requiredInlineRefs) {
  if (!exists(file)) continue;
  const body = read(file);
  for (const ref of refs) {
    if (!body.includes(ref)) {
      errors.push(`[DOC-REF] Missing canonical reference in ${file}: ${ref}`);
    }
  }
}

// 4) Active docs must not reintroduce legacy auth drift for current preview/AI paths
const forbiddenActivePhrases = [
  'k1w1-handler now also requires a verified operator JWT (`service_role|build_admin`) and uses the local legacy key only as a second scoped factor.',
  'plus den lokalen Legacy Edge Admin Key als zweiten Scoped-Faktor',
  'EXPO_PUBLIC_ENABLE_LEGACY_PREVIEW_OPERATOR_MODE=true',
  'alte Runtime-Pfade wie k1w1-handler/save_preview',
  'Legacy-Key ist gesetzt (Sunset). Fuer aktuelle Readiness gelten nur scoped Keys; Legacy bleibt nur fuer klar begrenzte Altpfade (z.B. k1w1-handler/save_preview).',
  'JWT + Claim + scoped Key',
  'JWT + Claim + scoped key',
  'JWT + Claim + scoped key sind implementiert',
  'Client sendet JWT + scoped key konsistent',
  'aktueller Repo-Stand nutzt JWT + Claim + scoped key',
  'KI-Pfad wurde in Fix-Durchlauf 2 auf JWT + Claim + scoped key gezogen',
  'save_preview sowie disabled lint/native-sync Stubs',
  'save_preview und disabled lint/native-sync Stubs',
  'save_preview bleibt auf dem Legacy-Admin-Secret-Vertrag',
  'save_preview bleibt Legacy',
  '`diagnostic_last_ok = true` oder klarer Next Step',
];
const activeDriftFiles = [
  'docs/PROJECT_CONTEXT.md',
  'docs/SYSTEM_README.md',
  'docs/04-risk-hotspots.md',
  'docs/06-build-readiness.md',
  'docs/01-state-contract.md',
  'docs/00-overview.md',
  'docs/03-screen-index.md',
  'docs/EDGE_FUNCTIONS_STATUS.md',
  'docs/reviews/Review.md',
  'lib/diagnostics/buildPipelineDiagnostics.ts',
  'screens/GitHubReposScreen/components/SecretsSection.tsx',
];
for (const file of activeDriftFiles) {
  if (!exists(file)) continue;
  const body = read(file);
  for (const phrase of forbiddenActivePhrases) {
    if (body.includes(phrase)) {
      errors.push(`[ACTIVE-DRIFT] Outdated current-state phrasing in ${file}: ${phrase}`);
    }
  }
}


// 5) Canonical docs should not keep redundant historical working copies around.
const redundantDocs = [
  'docs/reviews/deep-scan-review-2026-03-30.md',
  'docs/reviews/DEEP_SCAN_RESCAN_2026-04-01.md',
  'docs/reviews/FINAL_VERIFICATION_REPORT_2026-04-01.md',
  'docs/PROJECT_TODO.md',
  'docs/CHECKLOG_CLEANUP.md',
  'docs/notes/NEW_CHAT_PROMPT.md',
  'docs/notes/CHECKLOG_MERGE_NOTE.md',
  'docs/notes/CHECKLOG_SONET_NOTE.md',
  'docs/notes/CODESCREEN_REVIEW_OPUS.md',
  'docs/notes/FULL_REVIEW_2026-02-19.md',
  'docs/status/COMPLETE_PROJECT_STATUS_REPORT.md',
  'docs/status/EXECUTIVE_SUMMARY.md',
  'docs/refactor/META_ANALYSIS_CLAUDE_VS_GPT.md',
  'docs/refactor/QUICK_START.md',
  'docs/refactor/REFACTORING_PLAN_CRITICAL_REVIEW.md',
  'docs/refactor/REFACTORING_PLAN_V3.1_PATCHES.md',
  'docs/reviews/SCREENS_VERIFICATION.md',
  'docs/reviews/APP_INFO_SCREEN_VERIFICATION.md',
  'docs/reviews/APP_STATUS_SCREEN_VERIFICATION.md',
  'docs/reviews/BUILD_SCREEN_VERIFICATION.md',
  'docs/reviews/CHAT_SCREEN_VERIFICATION.md',
  'docs/reviews/CI_LITE_PROGRESS_HOTFIX_VERIFICATION.md',
  'docs/reviews/CI_LITE_PROGRESS_VERIFICATION.md',
  'docs/reviews/CODE_SCREEN_VERIFICATION.md',
  'docs/reviews/CONNECTIONS_SCREEN_VERIFICATION.md',
  'docs/reviews/CREDENTIALS_WIZARD_SCREEN_VERIFICATION.md',
  'docs/reviews/DIAGNOSTIC_SCREEN_VERIFICATION.md',
  'docs/reviews/GITHUB_REPOS_SCREEN_VERIFICATION.md',
  'docs/reviews/HEADER_CILITE_DISPATCH_VERIFICATION.md',
  'docs/reviews/PREVIEW_SCREENS_VERIFICATION.md',
  'docs/reviews/SETTINGS_SCREEN_VERIFICATION.md',
  'docs/reviews/SIDEBAR_CILITE_VERIFICATION.md',
  'docs/reviews/SIDEBAR_HEADER_CILITE_VERIFICATION.md',
  'docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md',
  'docs/reviews/TERMINAL_SCREEN_VERIFICATION.md',
  'docs/11-issue-pack.md',
  'docs/12-release-readiness-report.md',
  'docs/APP_BLUEPRINT.md',
  'docs/REFACTORING_SUMMARY.md',
  'docs/SCREEN_BY_SCREEN_CHECKLIST.md',
  'docs/expo_web_qr_preview_feasibility.md',
  'docs/snippets/PATCH_21_CI_CORE_SNIPPET.md',
  'memory/PRD.md',
  'scripts/getEasProjectId.js',
  'docs/README_EXTENDED.md',
  'docs/05-contract-test-coverage-matrix.md',
  'security-auth-rescan-2-zusammenfassung.md',
];
for (const file of redundantDocs) {
  if (exists(file)) {
    errors.push(`[DOC-CLEANUP] Redundant historical doc should be removed or archived: ${file}`);
  }
}

// 6) Active docs should carry a reasonably fresh `Stand:` marker.
const ACTIVE_DOC_MAX_AGE_DAYS = Number(process.env.DOCS_LINT_MAX_AGE_DAYS || 35);
const docsLintToday = (() => {
  const raw = process.env.DOCS_LINT_TODAY;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
})();

function parseStandDate(text) {
  const m = text.match(/^Stand:\s*(?:\*\*)?(\d{4}-\d{2}-\d{2})/m);
  if (!m) return null;
  const parsed = new Date(`${m[1]}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

const freshnessDocs = [
  'README.md',
  'docs/00-overview.md',
  'docs/01-state-contract.md',
  'docs/03-screen-index.md',
  'docs/06-build-readiness.md',
  'docs/EDGE_FUNCTIONS_STATUS.md',
  'docs/04-testing-smoke-plan.md',
  'docs/07-diagnostics-fix-playbook.md',
  'docs/08-test-coverage-matrix.md',
  'docs/reviews/Review.md',
  'docs/INDEX.md',
  'docs/TESTING_GUIDE.md',
  'docs/FRESH_CHECKOUT_GREEN_PATH.md',
  'docs/runbooks/APP_RUNBOOK.md',
  'docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md',
];
for (const file of freshnessDocs) {
  if (!exists(file)) continue;
  const body = read(file);
  const standDate = parseStandDate(body);
  if (!standDate) {
    errors.push(`[DOC-FRESHNESS] Missing or unreadable Stand date in ${file}`);
    continue;
  }
  const ageDays = Math.floor((docsLintToday.getTime() - standDate.getTime()) / (24 * 60 * 60 * 1000));
  if (ageDays > ACTIVE_DOC_MAX_AGE_DAYS) {
    errors.push(`[DOC-FRESHNESS] Stand date in ${file} is stale (${ageDays}d > ${ACTIVE_DOC_MAX_AGE_DAYS}d)`);
  }
}

// 7) Optional: check IDs in docs/07 exist in diagnostics code
const playbookFile = 'docs/07-diagnostics-fix-playbook.md';
if (exists(playbookFile)) {
  const playbook = read(playbookFile);
  const idMatches = playbook.match(/`([a-z][a-z0-9_.-]+)`/g) || [];
  const allowedPrefixes = ['local.', 'repo.', 'security-', 'workflow-', 'assets-', 'lockfile-', 'gitignore-', 'native-', 'eas-', 'core-', 'entry-', 'expo-', 'rn-', 'quality-'];
  const ids = Array.from(
    new Set(
      idMatches
        .map((s) => s.slice(1, -1))
        .filter((id) => allowedPrefixes.some((p) => id.startsWith(p)))
    )
  );

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

process.stdout.write('docsLint: OK\n');
