import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

describe("patch 435 github-run-artifact-json zip path normalization", () => {
  it("normalizes backslashes before suffix matching", () => {
    const src = read("supabase/functions/github-run-artifact-json/index.ts");

    expect(src).toContain("replace(/\\\\/g, \"/\")");
    expect(src).not.toContain("replace(/\\/g, \"/\")");
    expect(src).toContain("endsWith(\"/\" + target)");
  });
  it("keeps bounded availableFiles diagnostics in 404 details", () => {
    const routeSrc = read("supabase/functions/github-run-artifact-json/index.ts");
    const contractSrc = read("supabase/functions/github-run-artifact-json/responseContracts.ts");

    expect(routeSrc).toContain("fileNotFoundInArtifactZipResponse");
    expect(routeSrc).toContain("Operator diagnostics: keep a bounded preview");
    expect(contractSrc).toContain("File not found in artifact zip");
    expect(contractSrc).toContain("availableFiles: availableFiles.slice(0, 50)");
  });

});
