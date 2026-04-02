import { checkEntryPoint } from "../lib/diagnostics/checks/packageAndEntry";
import { makeProjectFile } from "./helpers/preflightTestHelpers";

describe("preflight entry-point autofix", () => {
  it("fails when no entry file exists and emits index.js + package.json main patch", () => {
    const result = checkEntryPoint.run([
      makeProjectFile("package.json", JSON.stringify({ name: "x", main: "src/main.js" })),
      makeProjectFile("src/other.ts", "export {}"),
    ], { mode: "eas", profile: "all" });

    expect(result.id).toBe("entry-point");
    expect(result.status).toBe("fail");
    expect(result.fix?.patch?.upsert?.some((u) => u.path === "index.js")).toBe(true);
    expect(result.fix?.patch?.jsonMerge?.[0]?.path).toBe("package.json");
    expect((result.fix?.patch?.jsonMerge?.[0]?.patch as { main?: string } | undefined)?.main).toBe("index.js");
  });
});
