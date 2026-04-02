import { ensureObj, majorOf } from "../lib/diagnostics/templates/jsonUtils";
import { patchAppJson } from "../lib/diagnostics/templates/patchers/appJson";
import { patchEasJson } from "../lib/diagnostics/templates/patchers/easJson";
import { patchPackageJson } from "../lib/diagnostics/templates/patchers/packageJson";

const toolchain = {
  expo: "~54.0.0",
  react: "19.0.0",
  reactNative: "0.81.0",
  reactDom: "19.0.0",
  jestExpo: "~54.0.0",
};

describe("jsonUtils + template patchers", () => {
  it("ensureObj normalizes non-object values to an empty record", () => {
    expect(ensureObj(null)).toEqual({});
    expect(ensureObj(["x"])).toEqual({});
    expect(ensureObj("x")).toEqual({});
    const obj = { ok: true };
    expect(ensureObj(obj)).toBe(obj);
  });

  it("majorOf reads semver-like majors conservatively", () => {
    expect(majorOf("~54.0.0")).toBe(54);
    expect(majorOf("19.0.0")).toBe(19);
    expect(majorOf("bad")).toBeNull();
  });

  it("patchAppJson still fills nested android/splash defaults via typed locals", () => {
    const result = patchAppJson("{}");
    const parsed = JSON.parse(result.next);
    expect(result.parseOk).toBe(true);
    expect(parsed.expo.platforms).toEqual(["android"]);
    expect(parsed.expo.android.adaptiveIcon.foregroundImage).toBe("./assets/adaptive-icon.png");
    expect(parsed.expo.splash.image).toBe("./assets/splash.png");
  });

  it("patchPackageJson keeps fallback semantics for non-object payloads", () => {
    const result = patchPackageJson("[]", toolchain);
    const parsed = JSON.parse(result.next);
    expect(result.parseOk).toBe(false);
    expect(parsed.dependencies.expo).toBe(toolchain.expo);
    expect(parsed.scripts["lint:ci"]).toBe("eslint . --quiet");
  });

  it("patchEasJson still ensures cli/build defaults via typed locals", () => {
    const result = patchEasJson("{}");
    const parsed = JSON.parse(result.next);
    expect(result.parseOk).toBe(true);
    expect(parsed.cli.appVersionSource).toBe("remote");
    expect(parsed.build.preview.android.buildType).toBe("apk");
    expect(parsed.build.production.android.buildType).toBe("apk");
  });
});
