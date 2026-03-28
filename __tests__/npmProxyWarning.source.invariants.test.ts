import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("npm http-proxy warning source invariants", () => {
  it("does not inject deprecated npm proxy env names from repo-managed workflows/scripts", () => {
    const workflow = read(".github/workflows/eas-build.yml");
    const manualCheck = read("scripts/check_eas_manual_trigger_controls.sh");
    const strictCheck = read("scripts/check_eas_strict_lockfile_policy.sh");

    const combined = [workflow, manualCheck, strictCheck].join("\n");
    expect(combined).not.toMatch(/npm_config_http-proxy/i);
    expect(combined).not.toMatch(/npm_config_https-proxy/i);
    expect(combined).not.toMatch(/export\s+npm_config_http_proxy=/i);
    expect(combined).not.toMatch(/export\s+npm_config_https_proxy=/i);
  });
});
