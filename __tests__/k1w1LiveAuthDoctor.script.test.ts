import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const scriptPath = path.join(process.cwd(), "scripts", "k1w1-live-auth-doctor.sh");

function runDoctor(opts: { env?: Record<string, string>; cwd?: string; curlStatus?: string; curlRc?: string }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "live-auth-doctor-"));
  const bin = path.join(tmp, "bin");
  fs.mkdirSync(bin);
  const curl = `#!/usr/bin/env bash\nstatus=\"${opts.curlStatus ?? "200"}\"\nif [[ \"${opts.curlRc ?? "0"}\" != \"0\" ]]; then exit ${opts.curlRc ?? "0"}; fi\nprintf '%s' \"$status\"\n`;
  fs.writeFileSync(path.join(bin, "curl"), curl, { mode: 0o755 });
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    SUPABASE_ANON_KEY: "anon-key-123456",
    K1W1_EDGE_WORKFLOW_ADMIN_KEY: "workflow-key-123456",
    K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY: "keystore-key-123456",
    ...opts.env,
  } as NodeJS.ProcessEnv;
  let status = 0;
  let out = "";
  try {
    out = execFileSync("bash", [scriptPath], { cwd: opts.cwd ?? process.cwd(), env, encoding: "utf8" });
  } catch (e: any) {
    status = e.status ?? 1;
    out = String(e.stdout ?? "") + String(e.stderr ?? "");
  }
  return { status, out, tmp };
}

describe("k1w1-live-auth-doctor script", () => {
  it("derives EDGE_BASE_URL from K1W1_SUPABASE_URL", () => {
    const run = runDoctor({ env: { EDGE_BASE_URL: "", K1W1_SUPABASE_URL: "https://abc.supabase.co" } });
    expect(run.status).toBe(0);
    expect(run.out).toContain("EDGE_BASE_URL=");
  });

  it("does not override shell env with empty .env.edge.live values", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "live-auth-doctor-env-"));
    fs.writeFileSync(path.join(tmp, ".env.edge.live"), "EDGE_BASE_URL=\n");
    const run = runDoctor({ cwd: tmp, env: { EDGE_BASE_URL: "https://shell.example/functions/v1" } });
    expect(run.status).toBe(0);
  });


  it("loads final .env.edge.live line without trailing newline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "live-auth-doctor-no-newline-"));
    fs.writeFileSync(
      path.join(tmp, ".env.edge.live"),
      [
        "SUPABASE_ANON_KEY=anon-key-123456",
        "K1W1_EDGE_WORKFLOW_ADMIN_KEY=workflow-key-123456",
        "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY=keystore-key-from-final-line",
      ].join("\n"),
    );

    const run = runDoctor({
      cwd: tmp,
      env: {
        EDGE_BASE_URL: "https://shell.example/functions/v1",
        SUPABASE_ANON_KEY: "",
        K1W1_EDGE_WORKFLOW_ADMIN_KEY: "",
        K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY: "",
      },
    });

    expect(run.status).toBe(0);
  });

  it("fails on non-2xx responses including 400/409/429", () => {
    for (const code of ["400", "409", "429"]) {
      const run = runDoctor({ env: { EDGE_BASE_URL: "https://x/functions/v1" }, curlStatus: code });
      expect(run.status).toBe(1);
    }
  });

  it("mutation failures affect exit when opt-in is enabled", () => {
    const run = runDoctor({ env: { EDGE_BASE_URL: "https://x/functions/v1", K1W1_LIVE_MUTATION_TESTS: "true" }, curlStatus: "500" });
    expect(run.status).toBe(1);
  });

  it("uses configured repo env instead of owner/repo dummy", () => {
    const run = runDoctor({ env: { EDGE_BASE_URL: "https://x/functions/v1", GITHUB_REPO_FULL_NAME: "acme/demo", GITHUB_BRANCH: "release" } });
    expect(run.out).toContain("GITHUB_REPO_FULL_NAME=acme/demo");
    expect(run.out).toContain("GITHUB_BRANCH=release");
  });
});
