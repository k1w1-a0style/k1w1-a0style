import { checkEntryPoint } from "../lib/diagnostics/checks/packageAndEntry";

describe("preflight entry-point autofix", () => {
  it("fails when no entry file exists and emits index.js + package.json main patch", () => {
    const result = checkEntryPoint.run([
      { path: "package.json", content: JSON.stringify({ name: "x", main: "src/main.js" }) } as any,
      { path: "src/other.ts", content: "export {}" } as any,
    ], { mode: "eas", profile: "all" });

    expect(result.id).toBe("entry-point");
    expect(result.status).toBe("fail");
    expect(result.fix?.patch?.upsert?.some((u) => u.path === "index.js")).toBe(true);
    expect(result.fix?.patch?.jsonMerge?.[0]?.path).toBe("package.json");
    expect((result.fix?.patch?.jsonMerge?.[0] as any)?.patch?.main).toBe("index.js");
  });
});
