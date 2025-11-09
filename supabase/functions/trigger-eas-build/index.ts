// supabase/functions/trigger-eas-build/index.ts
// v9.3 - nutzt expoToken aus Request, ENV-Fallbacks & setzt nur vorhandene Secrets

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Octokit } from "https://esm.sh/@octokit/rest@20.0.1";
import * as sodium from "https://esm.sh/libsodium-wrappers@0.7.13";

interface ProjectFile {
  path: string;
  content: string;
}

interface RequestBody {
  githubRepo: string;
  githubToken: string;
  files: ProjectFile[];
  expoToken?: string; // aus deinen App-Settings
}

interface BuildJob {
  id: number;
}

interface GitTreeElement {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILES = 200;
const MAX_FILE_SIZE = 1_500_000; // 1.5MB

function guessEncoding(content: string, path: string): "utf-8" | "base64" {
  if (
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".ico")
  ) {
    return "base64";
  }
  let nonAscii = 0;
  const limit = Math.min(content.length, 500);
  for (let i = 0; i < limit; i++) {
    const code = content.charCodeAt(i);
    if (code === 0) return "base64";
    if (code > 127) nonAscii++;
  }
  if (limit > 0 && nonAscii / limit > 0.1) return "base64";
  return "utf-8";
}

// GitHub Secret-Encryption
async function encryptForGitHub(publicKey: string, secret: string): Promise<string> {
  await sodium.ready;
  const key = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const bytes = sodium.from_string(secret);
  const encryptedBytes = sodium.crypto_box_seal(bytes, key);
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}

// Supabase ENV mit Fallback
function getSupabaseEnv() {
  const url =
    Deno.env.get("K1W1_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  return { url, serviceRoleKey };
}

// Expo Token ENV-Fallback
function getExpoTokenFromEnv() {
  return (
    Deno.env.get("K1W1_EXPO_TOKEN") ||
    Deno.env.get("EXPO_TOKEN") ||
    ""
  );
}

// setzt NUR vorhandene Secrets
async function ensureRepoSecrets(
  octokit: Octokit,
  owner: string,
  repo: string,
  explicitExpoToken?: string
) {
  const { url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } = getSupabaseEnv();
  const expoToken = explicitExpoToken || getExpoTokenFromEnv();

  if (!SUPABASE_URL && !SUPABASE_SERVICE_ROLE_KEY && !expoToken) {
    console.warn(
      "⚠️ Auto-Secrets: Keine Werte für SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / EXPO_TOKEN gefunden. Überspringe."
    );
    return;
  }

  try {
    const { data: publicKey } = await octokit.actions.getRepoPublicKey({ owner, repo });

    const secrets: Record<string, string> = {};

    if (SUPABASE_URL) secrets.SUPABASE_URL = SUPABASE_URL;
    if (SUPABASE_SERVICE_ROLE_KEY) secrets.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY;
    if (expoToken) secrets.EXPO_TOKEN = expoToken;

    const names = Object.keys(secrets);
    if (names.length === 0) {
      console.warn("⚠️ Auto-Secrets: Nichts zu setzen (alle Werte leer).");
      return;
    }

    for (const name of names) {
      const value = secrets[name];
      const encrypted_value = await encryptForGitHub(publicKey.key, value);
      await octokit.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: name,
        encrypted_value,
        key_id: publicKey.key_id,
      });
      console.log(`✅ Secret ${name} für ${owner}/${repo} gesetzt/aktualisiert`);
    }
  } catch (err: any) {
    console.error("❌ Fehler beim Setzen der GitHub-Secrets:", err?.message || err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let newJobId: number | null = null;
  let supabaseAdmin: any = null;
  let owner = "";
  let repo = "";
  let githubToken = "";
  let octokit: Octokit;
  let currentStep = "INIT";

  try {
    console.log("🚀 trigger-eas-build (v9.3) called");

    // 1. ENV Checks (für DB)
    currentStep = "ENV_CHECK";
    const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } = getSupabaseEnv();
    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      throw new Error("[ENV_CHECK] Supabase ENV Variablen fehlen (SUPABASE_URL / SERVICE_ROLE_KEY).");
    }
    supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 2. Body parsen
    currentStep = "PARSE_BODY";
    const body = (await req.json()) as RequestBody;

    if (!body.githubRepo || !body.githubRepo.includes("/")) {
      throw new Error("[PARSE_BODY] 'githubRepo' fehlt oder invalid (Format: owner/repo).");
    }
    if (!body.githubToken) {
      throw new Error("[PARSE_BODY] 'githubToken' fehlt.");
    }
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      throw new Error("[PARSE_BODY] 'files' array fehlt oder ist leer.");
    }

    githubToken = body.githubToken;
    [owner, repo] = body.githubRepo.split("/");

    console.log(`📦 Job requested for ${body.files.length} files in ${body.githubRepo}`);

    if (body.files.length > MAX_FILES) {
      throw new Error(`[FILES] Zu viele Dateien: ${body.files.length} > ${MAX_FILES}`);
    }
    for (const f of body.files) {
      if (f.content.length > MAX_FILE_SIZE) {
        throw new Error(`[FILES] Datei zu groß: ${f.path}`);
      }
    }

    // 3. Job in DB anlegen
    currentStep = "DB_INSERT";
    const { data: newJob, error: dbError } = await supabaseAdmin
      .from("build_jobs")
      .insert({ github_repo: body.githubRepo, status: "pending" })
      .select("id")
      .single();

    if (dbError) throw new Error(`[DB_INSERT] Insert fehlgeschlagen: ${dbError.message}`);
    newJobId = (newJob as BuildJob).id;
    console.log(`✅ Job ${newJobId} erstellt`);

    // 4. GitHub / Octokit
    currentStep = "GITHUB_INIT";
    octokit = new Octokit({ auth: githubToken });
    console.log("✅ Octokit initialisiert");

    // 4.1 Branch finden
    currentStep = "GITHUB_BRANCH";
    const branchCandidates = ["main", "master"];
    let parentCommitSha: string | null = null;
    let usedBranch: string | null = null;

    for (const b of branchCandidates) {
      try {
        const { data: refData } = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${b}`,
        });
        parentCommitSha = refData.object.sha;
        usedBranch = b;
        console.log(`✅ Branch gefunden: ${b} -> ${parentCommitSha}`);
        break;
      } catch (err: any) {
        console.warn(`ℹ️ Branch ${b} nicht gefunden: ${err.message}`);
      }
    }

    if (!parentCommitSha || !usedBranch) {
      throw new Error("[GITHUB_BRANCH] Kein main/master Branch gefunden. Repo/Token prüfen.");
    }

    // 4.2 Secrets setzen (Expo/Supabase)
    currentStep = "GITHUB_SECRETS";
    await ensureRepoSecrets(octokit, owner, repo, body.expoToken);

    // 4.3 Blobs erstellen
    currentStep = "GITHUB_BLOBS";
    console.log(`📝 Erstelle ${body.files.length} Blobs...`);

    const blobResults = await Promise.all(
      body.files.map((file) => {
        const encoding = guessEncoding(file.content, file.path);
        return octokit.git.createBlob({
          owner,
          repo,
          content: file.content,
          encoding,
        });
      })
    );

    const tree: GitTreeElement[] = blobResults.map((b, i) => ({
      path: body.files[i].path,
      mode: "100644",
      type: "blob",
      sha: b.data.sha,
    }));

    console.log("✅ Blobs erstellt");

    // 4.4 Tree erstellen
    currentStep = "GITHUB_CREATE_TREE";
    const { data: baseCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: parentCommitSha,
    });

    const { data: treeData } = await octokit.git.createTree({
      owner,
      repo,
      tree,
      base_tree: baseCommit.tree.sha,
    });

    console.log("✅ Tree erstellt");

    // 4.5 Commit
    currentStep = "GITHUB_CREATE_COMMIT";
    const commitMessage = `K1W1 App Build v${newJobId}`;
    const { data: commitData } = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: treeData.sha,
      parents: [parentCommitSha],
    });

    console.log(`✅ Commit erstellt: ${commitData.sha}`);

    // 4.6 Ref updaten (Push)
    currentStep = "GITHUB_PUSH";
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${usedBranch}`,
      sha: commitData.sha,
      force: false,
    });

    console.log("✅ Code nach GitHub gepusht");

    // 5. Job-Status -> pushed
    currentStep = "DB_UPDATE";
    await supabaseAdmin
      .from("build_jobs")
      .update({ status: "pushed", github_commit_sha: commitData.sha })
      .eq("id", newJobId);

    // 6. Workflow fürs Deploy der Functions auslösen
    currentStep = "GITHUB_WORKFLOW";
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: "deploy-supabase-functions.yml",
      ref: usedBranch,
      inputs: {
        job_id: String(newJobId),
      },
    });

    console.log("✅ Workflow deploy-supabase-functions.yml ausgelöst");

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Code gepusht, Secrets (soweit vorhanden) gesetzt und Build-Workflow ausgelöst.",
        job_id: newJobId,
        github_commit_sha: commitData.sha,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    const errorMessage = String(error?.message || "Unknown error");
    console.error(`❌ trigger-eas-build Error bei Schritt [${currentStep}]:`, errorMessage);
    console.error("Stack:", error.stack);

    let userFriendlyMessage = errorMessage;

    if (currentStep === "GITHUB_BRANCH") {
      userFriendlyMessage = `GitHub Fehler: Repository "${owner}/${repo}" nicht gefunden oder kein Zugriff. Prüfe Token-Berechtigungen!`;
    } else if (currentStep.startsWith("GITHUB_")) {
      userFriendlyMessage = `GitHub API Fehler (${currentStep}): ${errorMessage}`;
    } else if (currentStep.startsWith("DB_")) {
      userFriendlyMessage = `Datenbank Fehler (${currentStep}): ${errorMessage}`;
    } else if (currentStep === "ENV_CHECK") {
      userFriendlyMessage =
        "Supabase ENV Variablen fehlen (SUPABASE_URL / SERVICE_ROLE_KEY). Bitte in Supabase Project Settings setzen.";
    }

    if (newJobId && supabaseAdmin) {
      await supabaseAdmin
        .from("build_jobs")
        .update({
          status: "error",
          eas_build_id: `Error at ${currentStep}: ${errorMessage.substring(0, 100)}`,
        })
        .eq("id", newJobId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: userFriendlyMessage,
        step: currentStep,
        details: error.stack,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
