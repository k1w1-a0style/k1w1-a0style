import type { ProjectFile } from "../shared/types/project";

import {
  buildPreviewDependencies,
  buildPreviewFileMap,
  buildSnackPreviewFiles,
  ensureMinimumPreviewFiles,
  extractSessionAccessToken,
  getErrorStatusCode,
  normalizePreviewFilesForWeb,
  PREVIEW_REMOTE_FAIL_CLOSED_MESSAGE,
} from "../hooks/usePreviewFlowHelpers";

describe("usePreviewFlowHelpers", () => {
  test("keeps fail-closed preview copy stable", () => {
    expect(PREVIEW_REMOTE_FAIL_CLOSED_MESSAGE).toContain("Remote-Preview im Standardpfad nicht verfuegbar");
    expect(PREVIEW_REMOTE_FAIL_CLOSED_MESSAGE).toContain("lokaler HTML-/Eval-Fallback bleibt nur im expliziten Local-/Dev-Modus");
  });

  test("buildPreviewDependencies keeps web-safe deps and react defaults", () => {
    const dependencies = buildPreviewDependencies({
      "/package.json": JSON.stringify({
        dependencies: {
          expo: "~51.0.0",
          react: "^19.1.0",
          "@scope/lib": "1.2.3",
          "react-native": "0.76.0",
        },
      }),
      "/App.tsx": "import { View } from 'react-native'; export default View;",
    });

    expect(dependencies).toEqual({
      react: "^19.1.0",
      "@scope/lib": "1.2.3",
      "react-dom": "^19.1.0",
      "react-native-web": "^0.21.1",
    });
  });

  test("ensureMinimumPreviewFiles injects html/app/index/package defaults", () => {
    const ensured = ensureMinimumPreviewFiles({ "/src/feature.ts": "export const x = 1;" });
    expect(ensured["/public/index.html"]).toContain("<div id=\"root\"></div>");
    expect(ensured["/src/App.tsx"]).toContain("Preview läuft ✅");
    expect(ensured["/src/index.tsx"]).toContain('import App from "./App";');
    expect(ensured["/package.json"]).toContain("react-dom");
  });

  test("normalizePreviewFilesForWeb only rewrites JS/TS react-native imports", () => {
    const normalized = normalizePreviewFilesForWeb({
      "/App.tsx": "import { View } from 'react-native';\nconst x = require(\"react-native\");",
      "/README.md": "from 'react-native' should stay untouched",
    });

    expect(normalized["/App.tsx"]).toContain('from "react-native-web"');
    expect(normalized["/App.tsx"]).toContain('require("react-native-web")');
    expect(normalized["/README.md"]).toContain("from 'react-native'");
  });

  test("buildSnackPreviewFiles stringifies transport contents", () => {
    expect(buildSnackPreviewFiles({ "/App.tsx": "export default null;" })).toEqual({
      "/App.tsx": { contents: "export default null;" },
    });
  });

  test("extractSessionAccessToken and getErrorStatusCode keep strict narrowing", () => {
    expect(
      extractSessionAccessToken({ data: { session: { access_token: "  preview-token  " } } }),
    ).toBe("preview-token");
    expect(extractSessionAccessToken({ data: { session: null } })).toBeNull();
    expect(getErrorStatusCode({ status: 401 })).toBe(401);
    expect(getErrorStatusCode({ status: "401" })).toBeNull();
  });

  test("buildPreviewFileMap filters, sanitizes and reports skipped entries", () => {
    const input: ProjectFile[] = [
      { path: "src/App.tsx", content: "export default null;" },
      { path: "node_modules/a.ts", content: "ignore" },
      { path: "../escape.ts", content: "bad" },
    ];

    const out = buildPreviewFileMap(input, {
      isProjectFile: (value): value is { path: string; content: string } =>
        Boolean(
          value &&
            typeof value === "object" &&
            typeof (value as { path?: unknown }).path === "string" &&
            typeof (value as { content?: unknown }).content === "string",
        ),
      isAllowedFile: (path) => !path.includes("node_modules/"),
      sanitizePreviewPath: (raw) => (raw.startsWith("../") ? null : `/${raw.replace(/^\/+/, "")}`),
    });

    expect(out.fileMap).toEqual({
      "/src/App.tsx": "export default null;",
    });
    expect(out.skippedCount).toBe(2);
    expect(out.totalSize).toBe("export default null;".length);
  });
});
