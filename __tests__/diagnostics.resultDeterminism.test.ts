import { runPreflightChecksAll } from "../lib/diagnostics/preflightRunner";
import { loadFixtureFiles } from "./helpers/testDeps";

describe("diagnostics result determinism", () => {
  it("returns stable id/status/severity output for identical fixtures", () => {
    const files = loadFixtureFiles("missing-all-minimum");

    const normalize = (results: ReturnType<typeof runPreflightChecksAll>) =>
      results
        .map((r) => ({ id: r.id, status: r.status, severity: r.severity }))
        .sort((a, b) => a.id.localeCompare(b.id));

    const first = normalize(runPreflightChecksAll(files, { mode: "eas", profile: "preview" }));
    const second = normalize(runPreflightChecksAll(files, { mode: "eas", profile: "preview" }));

    expect(second).toEqual(first);
  });
});
