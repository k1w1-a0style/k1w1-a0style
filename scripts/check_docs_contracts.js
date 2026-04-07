#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function ensureContains(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`${label} is missing required marker: ${needle}`);
  }
}

function ensurePattern(text, pattern, label, human) {
  if (!pattern.test(text)) {
    throw new Error(`${label} is missing required pattern: ${human}`);
  }
}


const stateContract = read("docs/01-state-contract.md");
const buildReadiness = read("docs/06-build-readiness.md");
const appRunbook = read("docs/runbooks/APP_RUNBOOK.md");
const operatorChecklist = read("docs/runbooks/OPERATOR_SETUP_CHECKLIST.md");
const indexDoc = read("docs/INDEX.md");
const testingGuide = read("docs/TESTING_GUIDE.md");
const todoDoc = read("docs/TODO.md");
const reviewDoc = read("docs/reviews/Review.md");
const readme = read("README.md");

ensurePattern(stateContract, /verschl[üu]sselten? (Projekt-Blob|JSON-Blob|Projekt-Blob)/i, "docs/01-state-contract.md", "encrypted project storage");
ensureContains(stateContract, "diagnosticLastOkKeyForSelection", "docs/01-state-contract.md");
ensurePattern(buildReadiness, /build_admin/i, "docs/06-build-readiness.md", "build_admin operator contract");
ensureContains(buildReadiness, "edge:check:live", "docs/06-build-readiness.md");
ensureContains(appRunbook, "edge:check:live", "docs/runbooks/APP_RUNBOOK.md");
ensureContains(operatorChecklist, "build_admin", "docs/runbooks/OPERATOR_SETUP_CHECKLIST.md");
ensureContains(operatorChecklist, "edge:check:live", "docs/runbooks/OPERATOR_SETUP_CHECKLIST.md");
ensureContains(indexDoc, "[runbooks/OPERATOR_SETUP_CHECKLIST.md](runbooks/OPERATOR_SETUP_CHECKLIST.md)", "docs/INDEX.md");
ensureContains(indexDoc, "[00-overview.md](00-overview.md)", "docs/INDEX.md");
ensureContains(indexDoc, "[reviews/Review.md](reviews/Review.md)", "docs/INDEX.md");
ensureContains(indexDoc, "[patches/README.md](patches/README.md)", "docs/INDEX.md");
ensureContains(readme, "[Dokumentations-Index](docs/INDEX.md)", "README.md");
ensureContains(testingGuide, "typecheck:strict", "docs/TESTING_GUIDE.md");
ensureContains(testingGuide, "node_modules/expo/tsconfig.base.json", "docs/TESTING_GUIDE.md");
ensurePattern(todoDoc, /fruehere .*keine offenen Repo-Muss-Punkte.*nicht mehr haltbar/i, "docs/TODO.md", "truthful correction of legacy repo-must marker");
ensurePattern(todoDoc, /extern/i, "docs/TODO.md", "explicit external scope wording");
ensurePattern(todoDoc, /(offen|separat|ausserhalb)/i, "docs/TODO.md", "explicit open/scope disclaimer");
ensurePattern(reviewDoc, /Keine offenen Repo-Muss-Punkte/i, "docs/reviews/Review.md", "active review marker for repo must-points");
ensurePattern(reviewDoc, /extern/i, "docs/reviews/Review.md", "explicit external scope wording");
ensurePattern(reviewDoc, /(offen|separat|ausserhalb)/i, "docs/reviews/Review.md", "explicit open/scope disclaimer");
ensureContains(readme, "npm run verify:release", "README.md");
ensureContains(readme, "node_modules/expo/tsconfig.base.json", "README.md");


const removedDocs = [
  "docs/README_EXTENDED.md",
  "docs/05-contract-test-coverage-matrix.md",
  "security-auth-rescan-2-zusammenfassung.md",
];
for (const rel of removedDocs) {
  if (fs.existsSync(path.join(process.cwd(), rel))) {
    throw new Error(`Removed redundant doc reappeared: ${rel}`);
  }
}

console.warn("docs contracts OK");
