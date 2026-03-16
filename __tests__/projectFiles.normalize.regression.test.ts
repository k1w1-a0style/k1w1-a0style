import { normalizeProjectFiles } from "../screens/GitHubReposScreen/utils/projectFiles";

describe("GitHubReposScreen project files normalization regression", () => {
  it("filters null and malformed legacy project.files entries without crashing", () => {
    const normalized = normalizeProjectFiles([
      null,
      undefined,
      123,
      "broken",
      {},
      { path: null, content: "x" },
      { path: "   ", content: "x" },
      { path: "valid/a.ts", content: "ok" },
      { path: "valid/b.ts", content: 42 },
      { path: " valid/c.ts ", content: null },
    ]);

    expect(normalized).toEqual([
      { path: "valid/a.ts", content: "ok" },
      { path: "valid/b.ts", content: "42" },
      { path: "valid/c.ts", content: "" },
    ]);
  });
});
