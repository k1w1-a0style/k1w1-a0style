import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = process.cwd();
const RELEASE_SCRIPT_SRC = path.join(ROOT, "scripts/check_release_readiness.sh");

type SetupOptions = {
  withExpoTypecheck: boolean;
  withLiveContracts: boolean;
  failingScript?: string;
};

function setupFixture(options: SetupOptions): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-readiness-contract-"));
  const scriptsDir = path.join(dir, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });

  fs.copyFileSync(RELEASE_SCRIPT_SRC, path.join(scriptsDir, "check_release_readiness.sh"));

  const stubs = [
    "check_patch_docs_sync.sh",
    "check_workflow_template_drift.sh",
    "check_managed_workflows.sh",
    "check_supabase_deploy_workflow.sh",
    "check_eas_manual_trigger_controls.sh",
    "check_eas_production_credentials.sh",
    "check_eas_strict_lockfile_policy.sh",
    "check_workflow_edge_contracts.sh",
    "check_verify_jwt_visibility.sh",
    "check_edge_rate_limit_retention.sh",
    "check_legacy_disabled_edges.sh",
    "check_k1w1_handler_providers.sh",
    "check_edge_helper_visibility.sh",
    "check_supabase_rls_hardening.sh",
    "check_edge_live_env_readiness.sh",
    "check_edge_live_contracts.sh",
  ];

  for (const script of stubs) {
    const shouldFail = options.failingScript === script;
    fs.writeFileSync(
      path.join(scriptsDir, script),
      `#!/usr/bin/env bash\nset -euo pipefail\necho \"stub:${script}\"\n${shouldFail ? "exit 1" : "exit 0"}\n`,
      "utf8",
    );
  }

  const binDir = path.join(dir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, "node"), "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n", "utf8");
  fs.writeFileSync(path.join(binDir, "npm"), "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n", "utf8");
  fs.writeFileSync(path.join(binDir, "tsc"), "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n", "utf8");
  fs.chmodSync(path.join(binDir, "node"), 0o755);
  fs.chmodSync(path.join(binDir, "npm"), 0o755);
  fs.chmodSync(path.join(binDir, "tsc"), 0o755);

  if (options.withExpoTypecheck) {
    fs.mkdirSync(path.join(dir, "node_modules/expo"), { recursive: true });
    fs.writeFileSync(path.join(dir, "node_modules/expo/tsconfig.base.json"), "{}", "utf8");
  }

  for (const script of ["check_release_readiness.sh", ...stubs]) {
    fs.chmodSync(path.join(scriptsDir, script), 0o755);
  }

  const envFile = path.join(dir, ".env.json");
  fs.writeFileSync(
    envFile,
    JSON.stringify({
      path: binDir,
      withLiveContracts: options.withLiveContracts,
    }),
    "utf8",
  );

  return dir;
}

function runReleaseScript(dir: string): { stdout: string; status: number } {
  const { path: binPath, withLiveContracts } = JSON.parse(
    fs.readFileSync(path.join(dir, ".env.json"), "utf8"),
  ) as { path: string; withLiveContracts: boolean };

  try {
    const stdout = execFileSync("bash", ["scripts/check_release_readiness.sh"], {
      cwd: dir,
      env: {
        ...process.env,
        PATH: `${binPath}:${process.env.PATH ?? ""}`,
        EDGE_BASE_URL: withLiveContracts ? "https://edge.example/functions/v1" : "",
        EDGE_OPERATOR_JWT: withLiveContracts ? "jwt" : "",
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, status: 0 };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { stdout: `${e.stdout ?? ""}${e.stderr ?? ""}`, status: e.status ?? 1 };
  }
}

describe("release readiness execution contract", () => {
  it("fails hard when a mandatory child check fails", () => {
    const dir = setupFixture({ withExpoTypecheck: false, withLiveContracts: false, failingScript: "check_managed_workflows.sh" });
    const result = runReleaseScript(dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[verify:release] managed workflows");
    expect(result.stdout).toContain("stub:check_managed_workflows.sh");
    expect(result.stdout).not.toContain("[verify:release] OK_WITH_SKIPS");
    expect(result.stdout).not.toContain("[verify:release] OK_FULL");
  });

  it("reports OK_WITH_SKIPS when optional checks are legitimately skipped", () => {
    const dir = setupFixture({ withExpoTypecheck: false, withLiveContracts: false });
    const result = runReleaseScript(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skip app typecheck");
    expect(result.stdout).toContain("skip live edge contracts");
    expect(result.stdout).toContain(
      "[verify:release] OK_WITH_SKIPS (2 checks skipped; partial/local evidence only, not full release sign-off)",
    );
  });

  it("reports OK_FULL when no check is skipped", () => {
    const dir = setupFixture({ withExpoTypecheck: true, withLiveContracts: true });
    const result = runReleaseScript(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("stub:check_edge_live_contracts.sh");
    expect(result.stdout).toContain("[verify:release] OK_FULL");
    expect(result.stdout).not.toContain("OK_WITH_SKIPS");
  });
});
