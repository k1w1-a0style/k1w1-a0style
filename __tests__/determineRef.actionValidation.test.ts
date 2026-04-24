import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const actionPath = path.join(process.cwd(), ".github/actions/determine-ref/action.yml");

function buildExecutableScript(): string {
  const yaml = fs.readFileSync(actionPath, "utf8");
  const marker = "run: |\n";
  const idx = yaml.indexOf(marker);
  if (idx < 0) throw new Error("determine-ref action run block not found");

  const block = yaml.slice(idx + marker.length)
    .split("\n")
    .filter((line) => line.startsWith("        "))
    .map((line) => line.slice(8))
    .join("\n");

  return block
    .replaceAll('$INPUT_PAYLOAD_BRANCH', '${PAYLOAD_BRANCH:-}')
    .replaceAll('$INPUT_PAYLOAD_REF', '${PAYLOAD_REF:-}')
    .replaceAll('$INPUT_INPUT_REF', '${INPUT_REF:-}')
    .replaceAll('$INPUT_GITHUB_REF_NAME', '${GITHUB_REF_NAME:-}')
    .replaceAll('$INPUT_DEFAULT_REF', '${DEFAULT_REF:-}')
    .replaceAll('$INPUT_ALLOWED_REFS_CSV', '${ALLOWED_REFS_CSV:-}');
}

function runDetermineRef(inputs: {
  payloadBranch?: string;
  payloadRef?: string;
  inputRef?: string;
  githubRefName?: string;
  defaultRef?: string;
  allowedRefsCsv?: string;
}): { ok: boolean; output: string } {
  const script = buildExecutableScript();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "determine-ref-test-"));
  const scriptPath = path.join(tmpDir, "run.sh");
  const outputPath = path.join(tmpDir, "github_output.txt");
  fs.writeFileSync(scriptPath, script, "utf8");

  try {
    const output = execFileSync("bash", [scriptPath], {
      env: {
        ...process.env,
        PAYLOAD_BRANCH: inputs.payloadBranch ?? "",
        PAYLOAD_REF: inputs.payloadRef ?? "",
        INPUT_REF: inputs.inputRef ?? "",
        GITHUB_REF_NAME: inputs.githubRefName ?? "",
        DEFAULT_REF: inputs.defaultRef ?? "",
        ALLOWED_REFS_CSV: inputs.allowedRefsCsv ?? "",
        GITHUB_OUTPUT: outputPath,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("determine-ref action validation behavior", () => {
  it("rejects double-slash refs even when allowed_refs_csv is empty", () => {
    const result = runDetermineRef({ inputRef: "feature//hotfix", allowedRefsCsv: "" });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("forbidden slash placement");
  });

  it("accepts allowed refs and still enforces allowlist when set", () => {
    const okWithAllowlist = runDetermineRef({ inputRef: "work", allowedRefsCsv: "work,codex,dev,develop" });
    expect(okWithAllowlist.ok).toBe(true);
    expect(okWithAllowlist.output).toContain("CHECKOUT_REF=work");

    const blockedByAllowlist = runDetermineRef({ inputRef: "work", allowedRefsCsv: "dev,codex" });
    expect(blockedByAllowlist.ok).toBe(false);
    expect(blockedByAllowlist.output).toContain("Ref not in allowlist");
  });

  it("keeps existing safe rejections for refs/, .lock and '..'", () => {
    for (const ref of ["refs/heads/main", "topic.lock", "topic..next"]) {
      const result = runDetermineRef({ inputRef: ref, allowedRefsCsv: "" });
      expect(result.ok).toBe(false);
    }
  });
});
