import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

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

function setupFixture(opts?: FixtureOptions): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-disabled-edges-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "supabase/functions"), { recursive: true });

  fs.copyFileSync(SCRIPT_SRC, path.join(dir, "scripts/check_legacy_disabled_edges.sh"));
  fs.chmodSync(path.join(dir, "scripts/check_legacy_disabled_edges.sh"), 0o755);

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
      fs.writeFileSync(path.join(fnDir, "index.ts"), "export default {};\n", "utf8");
    }
  }

  if (!opts?.missingConfig) {
    fs.mkdirSync(path.join(dir, "supabase"), { recursive: true });
    const cfgPath = path.join(dir, "supabase/config.toml");
    if (opts?.unreadableConfig) {
      fs.symlinkSync("/proc/1/mem", cfgPath);
    } else {
      fs.writeFileSync(cfgPath, cfgLines.join("\n"), "utf8");
    }
  }

  return dir;
}

function run(dir: string): { status: number; output: string } {
  try {
    const output = execFileSync("bash", ["scripts/check_legacy_disabled_edges.sh"], {
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

  it("fails when supabase/config.toml is unreadable", () => {
    const dir = setupFixture({ unreadableConfig: true });
    const result = run(dir);

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
