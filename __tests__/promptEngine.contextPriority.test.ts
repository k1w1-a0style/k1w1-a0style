import { buildBuilderMessages } from "../lib/promptEngine";
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
});
