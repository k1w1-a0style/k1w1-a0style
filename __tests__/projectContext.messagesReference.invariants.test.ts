import fs from "fs";
import path from "path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("ProjectContext messages reference invariants", () => {
  it("memoizes context messages via helper and reuses memoized reference in context value", () => {
    const src = read("contexts/ProjectContext.tsx");

    expect(src).toContain("const contextMessages = useMemo(");
    expect(src).toContain("deriveProjectContextMessages(projectData?.chatHistory)");
    expect(src).toContain("[projectData?.chatHistory]");
    expect(src).toContain("messages: contextMessages");
  });
});
