import { patchFingerprint } from "../lib/diagnostics/fixSafety";

describe("patchFingerprint (content-sensitive dedupe)", () => {
  it("differs for same-structure patches with different content", () => {
    const a = {
      upsert: [{ path: "package.json", content: "{\"dep\":\"expo-router\"}" }],
    };
    const b = {
      upsert: [{ path: "package.json", content: "{\"dep\":\"react-native-reanimated\"}" }],
    };

    const fa = patchFingerprint(a as any);
    const fb = patchFingerprint(b as any);
    expect(fa).not.toEqual(fb);
  });

  it("is stable regardless of op ordering", () => {
    const p1 = {
      upsert: [
        { path: "a.txt", content: "A" },
        { path: "b.txt", content: "B" },
      ],
      delete: ["c.txt"],
      jsonMerge: [{ path: "x.json", patch: { b: 2, a: 1 } }],
    };

    const p2 = {
      delete: ["c.txt"],
      jsonMerge: [{ path: "x.json", patch: { a: 1, b: 2 } }],
      upsert: [
        { path: "b.txt", content: "B" },
        { path: "a.txt", content: "A" },
      ],
    };

    expect(patchFingerprint(p1 as any)).toEqual(patchFingerprint(p2 as any));
  });
});
