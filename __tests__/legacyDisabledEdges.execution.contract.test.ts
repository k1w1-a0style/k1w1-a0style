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
] as const;

function setupFixture(opts?: { breakStatus?: boolean }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-disabled-edges-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "supabase/functions"), { recursive: true });

  fs.copyFileSync(SCRIPT_SRC, path.join(dir, "scripts/check_legacy_disabled_edges.sh"));
  fs.chmodSync(path.join(dir, "scripts/check_legacy_disabled_edges.sh"), 0o755);

  const cfgLines: string[] = [];
  for (const fn of LEGACY) {
    cfgLines.push(`[functions.${fn}]`);
    cfgLines.push(`enabled = false`);
    cfgLines.push(`verify_jwt = true`);
    cfgLines.push("");

    const fnDir = path.join(dir, "supabase/functions", fn);
    fs.mkdirSync(fnDir, { recursive: true });
    fs.writeFileSync(
      path.join(fnDir, "index.ts"),
      [
        "export default function x(req: Request) {",
        "  requireScopedEdgeAuth(req, { adminSecretEnv: \"K1W1_EDGE_ADMIN_KEY\" });",
        `  return new Response(JSON.stringify({ disabled: true }), { status: ${opts?.breakStatus ? 200 : 410} });`,
        "}",
      ].join("\n"),
      "utf8",
    );
  }

  fs.mkdirSync(path.join(dir, "supabase"), { recursive: true });
  fs.writeFileSync(path.join(dir, "supabase/config.toml"), cfgLines.join("\n"), "utf8");
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
  it("passes for correctly disabled + guarded legacy edge stubs", () => {
    const dir = setupFixture();
    const result = run(dir);

    expect(result.status).toBe(0);
    expect(result.output).toContain("legacy disabled edge checks passed");
  });

  it("fails when disabled edge status contract drifts", () => {
    const dir = setupFixture({ breakStatus: true });
    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("Missing in supabase/functions/trigger-lint/index.ts: status: 410");
  });
});
