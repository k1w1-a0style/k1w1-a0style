import { buildBuilderMessages, buildProjectSnapshot } from "../lib/promptEngine";
import type { ProjectFile } from "../shared/types/project";

describe("promptEngine context prioritization", () => {
  it("prioritizes user-relevant files in project snapshot", () => {
    const files: ProjectFile[] = [
      { path: "src/irrelevant.ts", content: "export const a = 1;" },
      { path: "lib/normalizer.ts", content: "export function normalizeAiResponse(){}" },
      { path: "hooks/useChatAIFlow.ts", content: "const builder = true;" },
    ];

    const msgs = buildBuilderMessages([], "Bitte verbessere normalizer parser im chat flow", files);
    const snapshot = msgs[1]?.content ?? "";

    const idxNormalizer = snapshot.indexOf("# lib/normalizer.ts");
    const idxIrrelevant = snapshot.indexOf("# src/irrelevant.ts");

    expect(idxNormalizer).toBeGreaterThan(-1);
    expect(idxIrrelevant).toBeGreaterThan(-1);
    expect(idxNormalizer).toBeLessThan(idxIrrelevant);
    expect(snapshot).toContain("relevance=");
  });

  it("appends a complete sorted path list after the truncated snapshot", () => {
    const files: ProjectFile[] = Array.from({ length: 31 }, (_, idx) => ({
      path: `src/file-${String(31 - idx).padStart(2, "0")}.ts`,
      content: `export const file${idx} = ${idx};`,
    }));

    const snapshot = buildProjectSnapshot(files, "");
    const pathList = snapshot.split("Vollständige Projektpfade (sortiert):\n")[1] ?? "";

    expect(snapshot).toContain("Ausschnitt der aktuellen Projektdateien (gekürzt):");
    expect(snapshot).toContain("Vollständige Projektpfade (sortiert):");
    expect(pathList).toContain("src/file-01.ts");
    expect(pathList).toContain("src/file-31.ts");
    expect(pathList.indexOf("src/file-01.ts")).toBeLessThan(pathList.indexOf("src/file-31.ts"));
  });
});
