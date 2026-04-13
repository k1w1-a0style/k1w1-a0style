import { asAnySnippet, catchAnySnippet } from "./helpers/invariantSnippetHelpers";
import { readRepoText } from "./helpers/repoSourceHelpers";

describe("Patch 570 type/error contract invariants", () => {
  it("hardens useAppInfoScreen error contracts to unknown + guarded message access", () => {
    const src = readRepoText("screens/AppInfoScreen/hooks/useAppInfoScreen.ts");
    const helpersSrc = readRepoText("screens/AppInfoScreen/hooks/useAppInfoScreen.helpers.ts");
    const apiFlowSrc = readRepoText("screens/AppInfoScreen/hooks/useAppInfoApiConfigFlow.ts");
    const secureFlowSrc = readRepoText("screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow.ts");

    expect(src).toContain("function getErrorMessage(error: unknown, fallback: string): string");
    expect(apiFlowSrc).toContain("function isAbortLikeError(error: unknown): boolean");
    expect(secureFlowSrc).toContain("function isAbortLikeError(error: unknown): boolean");
    expect(src).toContain("toProjectFiles(getMaterializedProjectFiles(projectData))");
    expect(helpersSrc).toContain("export function toProjectFiles(value: unknown)");
    expect(src).not.toContain(asAnySnippet("projectData"));
    expect(src).not.toContain(catchAnySnippet("error"));
  });

  it("hardens useCiLitePatch JSON/error parsing to unknown + guards", () => {
    const src = readRepoText("components/CiLiteHeaderButton/hooks/useCiLitePatch.ts");

    expect(src).toContain("function getErrorMessage(error: unknown, fallback: string): string");
    expect(src).toContain("let parsed: unknown;");
    expect(src).toContain("JSON Parse Fehler:");
    expect(src).not.toContain("let parsed: " + "any;");
    expect(src).not.toContain(catchAnySnippet("e"));
  });
});
