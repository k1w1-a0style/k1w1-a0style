import { materializeProjectFiles } from "../lib/projectMaterializer";
import type { ProjectFile } from "../shared/types/project";

describe("project materializer fail-safe file hydration", () => {
  it("ignores null/primitive/malformed file entries without crashing", () => {
    const malformedFiles = [
      null,
      undefined,
      123,
      "broken",
      { content: "missing path" },
      { path: null, content: "x" },
      { path: "   ", content: "x" },
      { path: "package.json", content: '{"name":"legacy"}' },
      { path: "app.json", content: "{}" },
    ];
    expect(() =>
      materializeProjectFiles(malformedFiles as unknown as ProjectFile[], {
        name: "Demo App",
        slug: "demo-app",
        packageName: "com.demo.app",
      }),
    ).not.toThrow();

    const materialized = materializeProjectFiles(
      [null, "broken", { content: "missing path" }, { path: "package.json", content: '{"name":"legacy"}' }] as unknown as ProjectFile[],
      { name: "Demo App", slug: "demo-app", packageName: "com.demo.app" },
    );

    expect(materialized).toEqual([
      {
        path: "app.json",
        content: expect.stringContaining('"slug": "demo-app"'),
      },
      {
        path: "package.json",
        content: expect.stringContaining('"name": "demo-app"'),
      },
    ]);
  });
});
