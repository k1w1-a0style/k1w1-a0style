import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = process.cwd();
const VERIFY_JWT_SCRIPT_SRC = path.join(ROOT, "scripts/check_verify_jwt_visibility.sh");

const BASE_CONFIG = [
  "[functions.save_preview]",
  "verify_jwt = true",
  "",
  "[functions.k1w1-handler]",
  "verify_jwt = true",
  "",
  "[functions.preview_page]",
  "verify_jwt = false",
  "",
  "[functions.trigger-eas-build]",
  "verify_jwt = true",
  "",
  "[functions.check-eas-build]",
  "verify_jwt = true",
  "",
].join("\n");

const BASE_DOC = [
  "# Edge Functions Status",
  "",
  "## Aktiv und workflow-relevant",
  "",
  "| Function | Zweck | Vertrag |",
  "|---|---|---|",
  "| `save_preview` / `preview_page` | Preview | `save_preview` nutzt verifiziertes JWT (`verify_jwt=true`), `preview_page` bleibt Sonderpfad (`verify_jwt=false`). Marker: `verify_jwt:save_preview=true`, `verify_jwt:preview_page=false`. |",
  "| `k1w1-handler` | KI-Proxy | `k1w1-handler` Auth per JWT (`verify_jwt=true`). Marker: `verify_jwt:k1w1-handler=true`. |",
  "",
].join("\n");

function setupFixture(overrides?: { config?: string; doc?: string }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-jwt-visibility-contract-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "supabase"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });

  fs.copyFileSync(VERIFY_JWT_SCRIPT_SRC, path.join(dir, "scripts/check_verify_jwt_visibility.sh"));
  fs.chmodSync(path.join(dir, "scripts/check_verify_jwt_visibility.sh"), 0o755);

  fs.writeFileSync(path.join(dir, "supabase/config.toml"), overrides?.config ?? BASE_CONFIG, "utf8");
  fs.writeFileSync(path.join(dir, "docs/EDGE_FUNCTIONS_STATUS.md"), overrides?.doc ?? BASE_DOC, "utf8");

  return dir;
}

function runVerifyJwtGuard(dir: string): { status: number; output: string } {
  try {
    const output = execFileSync("bash", ["scripts/check_verify_jwt_visibility.sh"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: e.status ?? 1,
      output: `${e.stdout ?? ""}${e.stderr ?? ""}`,
    };
  }
}

describe("check_verify_jwt_visibility execution contract", () => {
  it("passes against the real repository config+docs contract", () => {
    const result = runVerifyJwtGuard(ROOT);

    expect(result.status).toBe(0);
    expect(result.output).toContain("verify_jwt visibility check passed.");
  });

  it("passes with matching verify_jwt config and required visibility markers", () => {
    const dir = setupFixture();
    const result = runVerifyJwtGuard(dir);

    expect(result.status).toBe(0);
    expect(result.output).toContain("verify_jwt visibility check passed.");
  });

  it("fails when a required verify_jwt value drifts", () => {
    const dir = setupFixture({
      config: BASE_CONFIG.replace("[functions.preview_page]\nverify_jwt = false", "[functions.preview_page]\nverify_jwt = true"),
    });
    const result = runVerifyJwtGuard(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("[FAIL] verify_jwt mismatch for functions.preview_page (expected false)");
  });

  it("fails when required doc visibility marker is missing from the matching function row", () => {
    const dir = setupFixture({
      doc: BASE_DOC.replace("`verify_jwt:k1w1-handler=true`", "`verify_jwt:k1w1-handler=missing`"),
    });
    const result = runVerifyJwtGuard(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("[FAIL] missing docs table marker verify_jwt:k1w1-handler=true for k1w1-handler");
  });


  it("fails when function token is only in Function-cell but not explicitly bound in Contract-cell", () => {
    const dir = setupFixture({
      doc: BASE_DOC.replace("Marker: `verify_jwt:k1w1-handler=true`.", "Marker fehlt."),
    });
    const result = runVerifyJwtGuard(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("[FAIL] missing docs table marker verify_jwt:k1w1-handler=true for k1w1-handler");
  });

  it("fails when marker exists only as decoy outside the relevant function row", () => {
    const driftedRow = "| `save_preview` / `preview_page` | Preview | `save_preview` nutzt verifiziertes JWT (`verify_jwt=true`), `preview_page` bleibt Sonderpfad ohne Marker-Hinweis. Marker: `verify_jwt:save_preview=true`. |";
    const decoyNote = "- Hinweis ausserhalb Tabelle: `verify_jwt:preview_page=false`";
    const dir = setupFixture({
      doc: BASE_DOC.replace(
        "| `save_preview` / `preview_page` | Preview | `save_preview` nutzt verifiziertes JWT (`verify_jwt=true`), `preview_page` bleibt Sonderpfad (`verify_jwt=false`). Marker: `verify_jwt:save_preview=true`, `verify_jwt:preview_page=false`. |",
        driftedRow,
      ).concat(`\n${decoyNote}\n`),
    });
    const result = runVerifyJwtGuard(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("[FAIL] missing docs table marker verify_jwt:preview_page=false for preview_page");
  });


  it("fails when expected marker exists in-row but is bound to a different function token", () => {
    const misleadingRow = "| `save_preview` / `preview_page` | Preview | `save_preview` nutzt verifiziertes JWT (`verify_jwt=true`) und `preview_page` nutzt gesicherten Zugang ohne explizites Flag. Marker: `verify_jwt:save_preview=true`, `verify_jwt:save_preview=false`. |";
    const dir = setupFixture({
      doc: BASE_DOC.replace(
        "| `save_preview` / `preview_page` | Preview | `save_preview` nutzt verifiziertes JWT (`verify_jwt=true`), `preview_page` bleibt Sonderpfad (`verify_jwt=false`). Marker: `verify_jwt:save_preview=true`, `verify_jwt:preview_page=false`. |",
        misleadingRow,
      ),
    });
    const result = runVerifyJwtGuard(dir);

    expect(result.status).toBe(1);
    expect(result.output).toContain("[FAIL] missing docs table marker verify_jwt:preview_page=false for preview_page");
  });

  it("passes with harmless wording changes in the row as long as function-bound markers remain", () => {
    const dir = setupFixture({
      doc: BASE_DOC.replace("Preview", "Browser Preview").replace("Auth per JWT", "Operator-Auth via JWT"),
    });
    const result = runVerifyJwtGuard(dir);

    expect(result.status).toBe(0);
    expect(result.output).toContain("verify_jwt visibility check passed.");
  });
});
