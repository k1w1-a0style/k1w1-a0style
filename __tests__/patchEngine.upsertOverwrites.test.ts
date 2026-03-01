import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";

describe("patch engine upsert", () => {
  it("overwrites exact content", async () => {
    const next = await applyPreflightPatch([
      { path: "file.txt", content: "old" },
    ] as any, {
      upsert: [{ path: "file.txt", content: "new-content" }],
    });

    expect(next.find((f) => f.path === "file.txt")?.content).toBe("new-content");
  });
});
