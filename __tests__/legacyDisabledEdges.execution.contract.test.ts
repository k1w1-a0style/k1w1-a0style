import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

const ROOT = process.cwd();
const SCRIPT_SRC = path.join(ROOT, "scripts/check_legacy_disabled_edges.sh");

const LEGACY = [
  "trigger-lint",
  "check-lint",
  "trigger-native-sync",
  "check-native-sync",
  "native-sync-report",
  "native-sync-report-ingest",
  "create_codesandbox",
] as const;

type FixtureOptions = {
  keepLegacyConfig?: boolean;
  keepLegacyDir?: boolean;
  missingConfig?: boolean;
  unreadableConfig?: boolean;
};

// Root bypasses POSIX DAC, so `chmod 000` on the config file does not make
// `head -c 1` fail when the test runs as uid=0 (common in CI containers).
// To honestly exercise the "unreadable config" branch of the shell script,
// we drop privileges to an unprivileged user via `runuser` when running as
// root on Linux. If that machinery is not available, we skip only the
// unreadable-config case with a documented reason, never silently.
const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;

function detectDropPrivHelper(): { bin: string; user: string } | null {
  if (!IS_ROOT) return null;
  for (const user of ["nobody", "daemon"]) {
    const probe = spawnSync("runuser", ["-u", user, "--", "true"], { stdio: "ignore" });
    if (probe.status === 0) return { bin: "runuser", user };
  }
  return null;
}

const DROP_PRIV = detectDropPrivHelper();
const CAN_TEST_UNREADABLE = !IS_ROOT || DROP_PRIV !== null;

function setupFixture(opts?: FixtureOptions): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-disabled-edges-"));
  // When running under a dropped-priv helper, the unprivileged user must be
  // able to traverse the fixture dirs and read the script, but must still be
  // denied on the intentionally-unreadable config file.
  fs.chmodSync(dir, 0o755);
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.chmodSync(path.join(dir, "scripts"), 0o755);
  fs.mkdirSync(path.join(dir, "supabase/functions"), { recursive: true });
  fs.chmodSync(path.join(dir, "supabase"), 0o755);
  fs.chmodSync(path.join(dir, "supabase/functions"), 0o755);

  const scriptDst = path.join(dir, "scripts/check_legacy_disabled_edges.sh");
  fs.copyFileSync(SCRIPT_SRC, scriptDst);
  fs.chmodSync(scriptDst, 0o755);

  const cfgLines: string[] = [];
  for (const fn of LEGACY) {
    if (opts?.keepLegacyConfig) {
      cfgLines.push(`[functions.${fn}]`);
      cfgLines.push("enabled = false");
      cfgLines.push("verify_jwt = true");
      cfgLines.push("");
    }

    if (opts?.keepLegacyDir) {
      const fnDir = path.join(dir, "supabase/functions", fn);
      fs.mkdirSync(fnDir, { recursive: true });
      fs.chmodSync(fnDir, 0o755);
      fs.writeFileSync(path.join(fnDir, "index.ts"), "export default {};\n", "utf8");
    }
  }

  if (!opts?.missingConfig) {
    const cfgPath = path.join(dir, "supabase/config.toml");
    if (opts?.unreadableConfig) {
      fs.writeFileSync(cfgPath, "# unreadable\n", "utf8");
      fs.chmodSync(cfgPath, 0o000);
    } else {
      fs.writeFileSync(cfgPath, cfgLines.join("\n"), "utf8");
      fs.chmodSync(cfgPath, 0o644);
    }
  }

  return dir;
}

type RunOpts = { dropPriv?: boolean };

function run(dir: string, runOpts?: RunOpts): { status: number; output: string } {
  const useDrop = runOpts?.dropPriv && DROP_PRIV !== null;
  const cmd = useDrop ? DROP_PRIV!.bin : "bash";
  const args = useDrop
    ? [
        "-u",
        DROP_PRIV!.user,
        "--",
        "bash",
        "scripts/check_legacy_disabled_edges.sh",
      ]
    : ["scripts/check_legacy_disabled_edges.sh"];
  try {
    const output = execFileSync(cmd, args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("legacy disabled edges execution contract", () => {
  it("passes when legacy disabled functions are fully removed from config + repo", () => {
    const dir = setupFixture();
    const result = run(dir);

    expect(result.status).toBe(0);
    expect(result.output).toContain("legacy disabled edge checks passed");
  });

  it("fails when supabase/config.toml is missing", () => {
    const dir = setupFixture({ missingConfig: true });
    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("Missing config file");
  });

  const itUnreadable = CAN_TEST_UNREADABLE ? it : it.skip;
  itUnreadable("fails when supabase/config.toml is unreadable", () => {
    const dir = setupFixture({ unreadableConfig: true });
    // When running as root, DAC is bypassed and `head -c 1` would succeed
    // regardless of mode 0o000. In that case drop to an unprivileged user so
    // the script's readability guard is actually exercised. In non-root CI
    // this is a no-op.
    const result = run(dir, { dropPriv: IS_ROOT });

    expect(result.status).toBe(1);
    expect(result.output).toContain("Config file is not readable");
  });

  it("fails when a legacy function still exists in config", () => {
    const dir = setupFixture({ keepLegacyConfig: true });
    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("Legacy function still configured");
  });

  it("fails when a legacy function directory is still present", () => {
    const dir = setupFixture({ keepLegacyDir: true });
    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("Legacy function directory still present");
  });
});
