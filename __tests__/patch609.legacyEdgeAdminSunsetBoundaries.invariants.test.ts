import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SOURCE_GLOBS = ["hooks", "lib", "screens", "infra", "components", "__tests__"] as const;

const ALLOWED_GET_LEGACY_CALLS = new Set([
  "__tests__/tokenStore.edgeAdminKey.test.ts",
  "__tests__/patch609.legacyEdgeAdminSunsetBoundaries.invariants.test.ts",
  "__tests__/patch615.previewLegacyOperatorBoundary.invariants.test.ts",
  "hooks/usePreview.ts",
  "lib/autoSyncRepoSecrets.ts",
  "lib/orchestrator/k1w1Edge.ts",
  "screens/AppInfoScreen/hooks/useAppInfoScreen.ts",
  "screens/ConnectionsScreen/hooks/useConnectionsScreen.ts",
  "screens/GitHubReposScreen/components/SecretsSection.tsx",
]);

function collectFiles(dirRel: string, acc: string[] = []): string[] {
  const abs = path.join(ROOT, dirRel);
  if (!fs.existsSync(abs)) return acc;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dirRel, entry.name);
    if (entry.isDirectory()) {
      collectFiles(rel, acc);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    acc.push(rel.replace(/\\/g, "/"));
  }
  return acc;
}

describe("patch609 legacy edge admin sunset boundaries", () => {
  it("keeps getLegacyEdgeAdminKey() usage confined to explicit compat/migration files", () => {
    const files = SOURCE_GLOBS.flatMap((dir) => collectFiles(dir));
    const offenders: string[] = [];

    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (!/\bgetLegacyEdgeAdminKey\s*\(/.test(src)) continue;
      if (!ALLOWED_GET_LEGACY_CALLS.has(rel)) offenders.push(rel);
    }

    expect(offenders).toEqual([]);
  });

  it("keeps wizard/signing runtime paths scoped-only (no legacy local-key reads)", () => {
    const wizardHook = fs.readFileSync(
      path.join(ROOT, "screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts"),
      "utf8",
    );
    const signingGate = fs.readFileSync(
      path.join(ROOT, "screens/EnhancedBuildScreen/hooks/signingKeyGate.ts"),
      "utf8",
    );

    expect(wizardHook).not.toMatch(/\bgetLegacyEdgeAdminKey\s*\(/);
    expect(signingGate).not.toMatch(/\bgetLegacyEdgeAdminKey\s*\(/);
    expect(signingGate).toContain("getAndroidKeystoreExportAdminKey");
  });
});
