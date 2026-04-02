import fs from "fs";
import path from "path";

describe("ZIP import normalization invariants", () => {
  const contextFile = path.join(process.cwd(), "contexts/ProjectContext.tsx");
  const helperFile = path.join(process.cwd(), "contexts/projectContextHelpers.ts");
  const contextSource = fs.readFileSync(contextFile, "utf8");
  const helperSource = fs.readFileSync(helperFile, "utf8");

  it("routes ZIP imports through normalizeLoadedProjectData before persisting", () => {
    expect(contextSource).toContain("const normalizedProject = normalizeLoadedProjectData(result.project);");
    expect(contextSource).toContain("setProjectData(normalizedProject);");
    expect(contextSource).toContain("await saveProjectToStorage(normalizedProject);");
  });

  it("normalizes missing slugs when loading persisted or imported projects", () => {
    expect(helperSource).toContain("slug: normalizeProjectSlug(project.slug ?? project.name),");
    expect(helperSource).toContain("export const normalizeProjectSlug");
  });
});
