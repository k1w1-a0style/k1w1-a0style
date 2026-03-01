import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";

describe("patch engine delete", () => {
  it("removes file reliably", async () => {
    const next = await applyPreflightPatch([
      { path: "yarn.lock", content: "old-lock" },
      { path: "package.json", content: "{}" },
    ] as any, {
      delete: ["yarn.lock"],
    });

    expect(next.some((f) => f.path === "yarn.lock")).toBe(false);
  });
});
