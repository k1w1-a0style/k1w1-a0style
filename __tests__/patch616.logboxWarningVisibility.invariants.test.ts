import fs from "fs";
import path from "path";

const ROOT = process.cwd();

describe("patch616 logbox warning visibility invariants", () => {
  it("keeps global LogBox suppression narrow and does not hide architecture/list warnings", () => {
    const appSource = fs.readFileSync(path.join(ROOT, "App.tsx"), "utf8");

    expect(appSource).toContain("LogBox.ignoreLogs([");
    expect(appSource).toContain(
      "Sending `onAnimatedValueUpdate` with no listeners registered.",
    );

    expect(appSource).not.toContain("Require cycle:");
    expect(appSource).not.toContain("VirtualizedLists should never be nested");
    expect(appSource).not.toContain("ignoreAllLogs");
  });
});
