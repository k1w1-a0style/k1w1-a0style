import { defaultEasIgnore } from "../lib/diagnostics/templates/defaults";

describe("template default .easignore", () => {
  it("includes .npmrc guards", () => {
    const template = defaultEasIgnore();

    expect(template).toContain(".npmrc");
    expect(template).toContain("**/.npmrc");
  });
});
