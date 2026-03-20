import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

function collectTsSources(relDir: string): string[] {
  const dir = path.join(repoRoot, relDir);
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relPath = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      return collectTsSources(relPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [relPath] : [];
  });
}

describe("patch513 key manager runtime boundary invariants", () => {
  it("keeps the productive orchestrator on the edge-proxy path only", () => {
    const src = read("lib/orchestrator/index.ts");

    expect(src).toContain("import { invokeK1w1Handler } from './k1w1Edge';");
    expect(src).toContain("const result = await invokeK1w1Handler({");
    expect(src).not.toContain("orchestrator/providers");
    expect(src).not.toContain("callOpenAI(");
    expect(src).not.toContain("callGemini(");
    expect(src).not.toContain("callGroq(");
    expect(src).not.toContain("callAnthropic(");
    expect(src).not.toContain("callHuggingFace(");
  });

  it("removes the retired direct client provider helper directory", () => {
    expect(fs.existsSync(path.join(repoRoot, "lib/orchestrator/providers"))).toBe(false);
  });

  it("keeps product/runtime sources free of legacy client-provider imports", () => {
    const runtimeFiles = [
      ...collectTsSources("lib"),
      ...collectTsSources("contexts"),
    ].filter((rel) => !rel.includes("__tests__"));

    for (const rel of runtimeFiles) {
      const src = read(rel);
      expect(src).not.toContain("orchestrator/providers/");
      expect(src).not.toContain("orchestrator/providers'");
      expect(src).not.toContain('orchestrator/providers"');
    }
  });

  it("keeps SecureKeyManager out of the productive runtime path", () => {
    const managerSrc = read("lib/SecureKeyManager.ts");
    const aiContextSrc = read("contexts/AIContext/index.tsx");
    const runtimeFiles = [
      ...collectTsSources("lib"),
      ...collectTsSources("contexts"),
    ].filter((rel) => !rel.includes("__tests__"));

    expect(managerSrc).toContain("keine Runtime-Verwendung im produktiven KI-Pfad");
    expect(aiContextSrc).toContain("Produktive KI-Requests laufen seit Patch 500 ausschliesslich ueber den Edge-Proxy");
    expect(aiContextSrc).not.toContain("SecureKeyManager");

    const secureKeyImports = runtimeFiles.filter((rel) => rel !== "lib/SecureKeyManager.ts" && read(rel).includes("SecureKeyManager"));
    expect(secureKeyImports).toEqual([]);
  });

  it("removes SecureTokenManager from the repo so it cannot drift back into runtime use", () => {
    const runtimeFiles = [
      ...collectTsSources("lib"),
      ...collectTsSources("contexts"),
    ].filter((rel) => !rel.includes("__tests__"));

    expect(fs.existsSync(path.join(repoRoot, "lib/SecureTokenManager.ts"))).toBe(false);

    for (const rel of runtimeFiles) {
      expect(read(rel)).not.toContain("SecureTokenManager");
    }
  });
});
