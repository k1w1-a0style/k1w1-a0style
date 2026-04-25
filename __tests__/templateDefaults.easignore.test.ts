import fs from "fs";
import path from "path";
import { defaultEasIgnore } from "../lib/diagnostics/templates/defaults";

describe("template default .easignore", () => {
  it("includes .npmrc guards", () => {
    const template = defaultEasIgnore();

    expect(template).toContain(".npmrc");
    expect(template).toContain("**/.npmrc");
  });

  it("keeps android native included but excludes local android artifacts in .easignore", () => {
    const file = fs.readFileSync(path.join(__dirname, "..", ".easignore"), "utf8");

    expect(file).not.toContain("\nandroid/\n");
    expect(file).toContain("android/local.properties");
    expect(file).toContain("android/.gradle/");
    expect(file).toContain("android/app/debug.keystore");
  });
});
