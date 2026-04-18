import { buildBuilderMessages, buildPlannerMessages, buildValidatorMessages } from "../lib/promptEngine";
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

  it("filters common english stopwords in focus scoring", () => {
    const files: ProjectFile[] = [
      { path: "src/irrelevant.ts", content: "export const x = 1;" },
      { path: "screens/LoginScreen.tsx", content: "export function LoginScreen(){ return null; }" },
    ];

    const msgs = buildBuilderMessages([], "please add login screen", files);
    const snapshot = msgs[1]?.content ?? "";

    const idxLogin = snapshot.indexOf("# screens/LoginScreen.tsx");
    const idxIrrelevant = snapshot.indexOf("# src/irrelevant.ts");
    expect(idxLogin).toBeGreaterThan(-1);
    expect(idxIrrelevant).toBeGreaterThan(-1);
    expect(idxLogin).toBeLessThan(idxIrrelevant);
  });

  it("keeps a full AI path manifest for validator even when aiFiles are budget-trimmed", () => {
    const aiFiles: ProjectFile[] = Array.from({ length: 20 }, (_, index) => ({
      path: `screens/Generated${index}.tsx`,
      content: `export const Generated${index} = () => <View>${"x".repeat(6000)}</View>;`,
    }));

    const msgs = buildValidatorMessages("create settings page", aiFiles, aiFiles, "openai");
    const manifest = msgs[2]?.content ?? "";
    const draftJson = msgs[msgs.length - 1]?.content ?? "";

    expect(manifest).toContain("Vollständige AI-Zielpfade");
    expect(manifest).toContain("screens/Generated19.tsx");
    expect(manifest).toContain("Nicht vollständig inline im JSON enthalten");
    expect(draftJson).not.toContain("screens/Generated19.tsx");
  });

  it("requires structured SLOT questions in planner system instructions", () => {
    const planner = buildPlannerMessages([], "Mach den Build stabiler", [], "openai");
    const system = planner[0]?.content ?? "";
    expect(system).toContain("strukturierte Slot-Liste");
    expect(system).toContain("[SLOT] <Name>: <Frage>");
  });

  it("asks for a block plan first when planner context indicates a large task scope", () => {
    const manyFiles: ProjectFile[] = Array.from({ length: 30 }, (_, index) => ({
      path: `src/feature/File${index}.ts`,
      content: `export const file${index} = "${"x".repeat(300)}";`,
    }));

    const planner = buildPlannerMessages([], "Bitte refactore den ganzen Chat- und Build-Flow", manyFiles, "openai");
    const userInstruction = planner[planner.length - 1]?.content ?? "";

    expect(userInstruction).toContain("Scope wirkt groß");
    expect(userInstruction).toContain("Blockplan");
    expect(userInstruction).toContain("starte nur mit Block 1");
  });

  it("limits builder output to block 1 when budget indicates a large task scope", () => {
    const manyFiles: ProjectFile[] = Array.from({ length: 40 }, (_, index) => ({
      path: `src/builder/File${index}.ts`,
      content: `export const builder${index} = "${"y".repeat(400)}";`,
    }));

    const builder = buildBuilderMessages([], "Bitte überarbeite den kompletten Builder-Stack", manyFiles, "openai");
    const userInstruction = builder[builder.length - 1]?.content ?? "";

    expect(userInstruction).toContain("Scope wirkt groß");
    expect(userInstruction).toContain("Liefere nur Block 1");
    expect(userInstruction).toContain("nächsten Durchlauf");
  });
});
