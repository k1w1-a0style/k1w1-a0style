import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";

describe("patch engine apply order", () => {
  it("applies delete -> upsert -> jsonMerge", async () => {
    const files = [
      { path: "foo.txt", content: "old" },
      { path: "bar.json", content: JSON.stringify({ keep: true }) },
    ];

    const next = await applyPreflightPatch(files as any, {
      delete: ["foo.txt"],
      upsert: [{ path: "foo.txt", content: "new" }],
      jsonMerge: [{ path: "bar.json", patch: { a: 1 }, createIfMissing: false }],
    });

    const m = new Map(next.map((f) => [f.path, f.content] as const));
    expect(m.get("foo.txt")).toBe("new");
    expect(JSON.parse(m.get("bar.json") as string)).toEqual({ keep: true, a: 1 });
  });
});
