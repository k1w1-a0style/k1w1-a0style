import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("critical-path silent catch debt", () => {
  const files = [
    "screens/shared/preview/useWebViewNavigation.ts",
    "screens/GitHubReposScreen/components/RepoMetaSection.tsx",
    "screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts",
    "screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts",
    "screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts",
    "lib/chatPrivacySettings.ts",
  ];

  it.each(files)("avoids silent catch swallowing in %s", (file) => {
    const src = read(file);
    expect(src).not.toMatch(/\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/);
    expect(src).not.toMatch(/catch\s*\{\s*\}/);
  });
});
