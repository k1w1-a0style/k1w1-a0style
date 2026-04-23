import fs from "fs";
import path from "path";

const appConfigSource = fs.readFileSync(path.join(process.cwd(), "app.config.js"), "utf8");

describe("app.config EAS projectId contract", () => {
  it("rejects sentinel/dummy IDs and requires a real linked UUID", () => {
    expect(appConfigSource).toContain("EAS_PROJECT_ID_SENTINELS");
    expect(appConfigSource).toContain("00000000-0000-4000-8000-000000000000");
    expect(appConfigSource).toContain("__unlinked_eas_project_id__");
    expect(appConfigSource).toContain("missing or invalid");
  });
});
