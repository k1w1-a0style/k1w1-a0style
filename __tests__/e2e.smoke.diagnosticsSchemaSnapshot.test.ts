import { runPreflightChecksAll } from "../lib/diagnostics/preflightRunner";
import { loadFixtureFiles } from "./helpers/testDeps";

describe("e2e smoke diagnostics schema snapshot", () => {
  it("keeps stable diagnostics schema (id/status/severity)", () => {
    const files = loadFixtureFiles("missing-all-minimum");
    const results = runPreflightChecksAll(files, { mode: "eas", profile: "preview" });

    const slim = results.map((r) => ({
      id: r.id,
      status: r.status,
      severity: r.severity,
    }));

    expect(slim).toMatchSnapshot();
  });
});
