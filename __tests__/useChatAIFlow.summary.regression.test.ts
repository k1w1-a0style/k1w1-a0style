import { buildPathBulletList } from "../hooks/useChatAIFlow";

describe("useChatAIFlow summary regression", () => {
  it("renders file paths inside bullet points", () => {
    const result = buildPathBulletList(
      ["src/new.ts", "src/changed.ts", "src/skipped.ts"],
      6,
    );

    expect(result).toContain("• src/new.ts");
    expect(result).toContain("• src/changed.ts");
    expect(result).toContain("• src/skipped.ts");
  });

  it("shows overflow hint after preview limit", () => {
    const result = buildPathBulletList(
      ["a.ts", "b.ts", "c.ts", "d.ts"],
      3,
    );

    expect(result).toContain("• a.ts");
    expect(result).toContain("• b.ts");
    expect(result).toContain("• c.ts");
    expect(result).toContain("... und 1 weitere");
  });
});
