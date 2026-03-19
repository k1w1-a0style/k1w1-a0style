import { trimPromptContextToBudget } from "../aiContextBudget";

describe("aiContextBudget", () => {
  it("trims older history first when prompt context overflows", () => {
    const result = trimPromptContextToBudget({
      history: Array.from({ length: 12 }, (_, index) => ({
        role: "user" as const,
        content: `history-${index} ` + "x".repeat(3000),
      })),
      projectFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      userContent: "Bitte aktualisiere App.tsx",
      mode: "builder",
      provider: "openai",
    });

    expect(result.stats.droppedHistoryCount).toBeGreaterThan(0);
    expect(result.projectFiles).toHaveLength(1);
    expect(result.history[0]?.content).toContain("history-");
    expect(result.history.some((entry) => entry.content.includes("history-0"))).toBe(false);
    expect(result.history[result.history.length - 1]?.content).toContain("history-11");
  });

  it("reduces snapshot files and then trims file excerpts when needed", () => {
    const result = trimPromptContextToBudget({
      history: [],
      projectFiles: Array.from({ length: 22 }, (_, index) => ({
        path: `screens/Screen${index}.tsx`,
        content: `export const Screen${index} = () => <View>${"y".repeat(5000)}</View>;`,
      })),
      userContent: "Baue den Chat-Flow und die Validator-Ausgabe um",
      mode: "validator",
      provider: "openai",
    });

    expect(result.stats.droppedFileCount).toBeGreaterThan(0);
    expect(result.stats.trimmedFileCount).toBeGreaterThan(0);
    expect(result.projectFiles.every((file) => file.content.length <= 4000)).toBe(true);
    expect(result.note).toContain("Snapshot-Dateien");
  });

  it("keeps small contexts untouched", () => {
    const files = [{ path: "components/Button.tsx", content: "export const Button = () => null;" }];
    const result = trimPromptContextToBudget({
      history: [{ role: "user", content: "kurz" }],
      projectFiles: files,
      userContent: "Bitte ändere nur den Button-Text",
      mode: "builder",
      provider: "openai",
    });

    expect(result.stats).toEqual({
      droppedHistoryCount: 0,
      droppedFileCount: 0,
      trimmedFileCount: 0,
    });
    expect(result.note).toBeNull();
    expect(result.projectFiles).toEqual(files);
  });
});
