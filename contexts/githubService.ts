// contexts/githubService.ts - simplified token handling + repo secrets sync

// ✅ FIX: SecureStore für sensitive Tokens statt AsyncStorage
import * as SecureStore from "expo-secure-store";
import { seal } from "tweetsodium";
import { Buffer } from "buffer";
import { ProjectFile } from "./types";
import { RateLimiter } from "../lib/RateLimiter";

// ✅ FIX: Buffer Polyfill Check (besserer Check)
if (typeof Buffer === "undefined" || typeof Buffer.from !== "function") {
  throw new Error(
    '❌ Buffer polyfill fehlt oder ist unvollständig. Bitte "buffer" Package installieren: npm install buffer',
  );
}

const GH_TOKEN_KEY = "github_pat_v1";
const EXPO_TOKEN_KEY = "expo_token_v1";

// ✅ FIX: Rate Limiter für GitHub API (5000/hour, wir nutzen 4000 als Buffer)
const githubLimiter = new RateLimiter({
  maxRequests: 4000,
  windowMs: 3600000, // 1 hour
});

type RepoSecretsPayload = Partial<{
  expoToken: string | null | undefined;
  supabaseUrl: string | null | undefined;
  supabaseServiceRole: string | null | undefined;
}>;

const SECRET_NAME_MAP: Record<keyof RepoSecretsPayload, string> = {
  expoToken: "EXPO_TOKEN",
  supabaseUrl: "SUPABASE_URL",
  supabaseServiceRole: "SUPABASE_SERVICE_ROLE_KEY",
};

// ✅ FIX: SecureStore Wrapper-Funktionen (verschlüsselt!)
const saveSecureToken = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error: any) {
    console.error(`[SecureStore] Fehler beim Speichern von ${key}:`, error);
    throw new Error(
      `Token konnte nicht sicher gespeichert werden: ${error.message}`,
    );
  }
};

const getSecureToken = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error: any) {
    console.error(`[SecureStore] Fehler beim Laden von ${key}:`, error);
    return null;
  }
};

const deleteSecureToken = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error: any) {
    console.error(`[SecureStore] Fehler beim Löschen von ${key}:`, error);
  }
};

const encryptSecret = (publicKey: string, value: string): string => {
  const messageBytes = Buffer.from(value);
  const keyBytes = Buffer.from(publicKey, "base64");
  const encryptedBytes = seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString("base64");
};

const ensureGitHubRepoParts = (
  fullName: string,
): { owner: string; repo: string } => {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Ungültiges Repo-Format: ${fullName}`);
  }
  return { owner, repo };
};

// GitHub Contents API expects slashes as path separators. Encode each segment, not the whole string.
const encodeGitHubPath = (p: string): string => {
  return p
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
};

/**
 * Speichert GitHub Token (SecureStore - verschlüsselt)
 */
export const saveGitHubToken = async (token: string): Promise<void> => {
  await saveSecureToken(GH_TOKEN_KEY, token);
  console.log("✅ GitHub Token sicher gespeichert (SecureStore).");
};

/**
 * Lädt GitHub Token
 */
export const getGitHubToken = async (): Promise<string | null> => {
  return getSecureToken(GH_TOKEN_KEY);
};

/**
 * Speichert Expo Token (SecureStore - verschlüsselt)
 */
export const saveExpoToken = async (token: string): Promise<void> => {
  await saveSecureToken(EXPO_TOKEN_KEY, token);
  console.log("✅ Expo Token sicher gespeichert (SecureStore).");
};

/**
 * Lädt Expo Token
 */
export const getExpoToken = async (): Promise<string | null> => {
  return getSecureToken(EXPO_TOKEN_KEY);
};

/**
 * Prüft ob GitHub Token vorhanden ist
 */
export const hasValidGitHubToken = async (): Promise<boolean> => {
  const value = await getGitHubToken();
  return !!value;
};

/**
 * Prüft ob Expo Token vorhanden ist
 */
export const hasValidExpoToken = async (): Promise<boolean> => {
  const value = await getExpoToken();
  return !!value;
};

/**
 * Löscht GitHub Token
 */
export const deleteGitHubToken = async (): Promise<void> => {
  await deleteSecureToken(GH_TOKEN_KEY);
};

/**
 * Löscht Expo Token
 */
export const deleteExpoToken = async (): Promise<void> => {
  await deleteSecureToken(EXPO_TOKEN_KEY);
};

/**
 * Synchronisiert Secrets (Expo/Supabase) mit dem aktiven GitHub-Repo.
 * ✅ FIX: Rate Limiting + besseres Error Handling
 */
export const syncRepoSecrets = async (
  repoFullName: string,
  payload: RepoSecretsPayload,
): Promise<{ updated: string[] }> => {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "GitHub Token fehlt – bitte im Verbindungen Screen setzen.",
    );
  }

  const { owner, repo } = ensureGitHubRepoParts(repoFullName);
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ✅ Rate Limit Check
  await githubLimiter.checkLimit();

  const keyRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
    { headers },
  );

  // ✅ Besseres Error Handling
  if (!keyRes.ok) {
    const status = keyRes.status;
    if (status === 401) {
      throw new Error(
        "GitHub Token ungültig. Bitte in Einstellungen neu eingeben.",
      );
    }
    if (status === 403) {
      throw new Error('Keine Berechtigung. Token benötigt "repo" Scope.');
    }
    if (status === 404) {
      throw new Error("Repository nicht gefunden oder kein Zugriff.");
    }
    const msg = await keyRes.text();
    throw new Error(
      `Public Key konnte nicht geladen werden (${status}): ${msg}`,
    );
  }

  const { key, key_id } = await keyRes.json();
  if (!key || !key_id) {
    throw new Error("GitHub Public Key Antwort unvollständig.");
  }

  const updated: string[] = [];

  for (const [field, secretName] of Object.entries(SECRET_NAME_MAP)) {
    const value = payload[field as keyof RepoSecretsPayload];
    if (!value) continue;

    const encrypted_value = encryptSecret(key, value);

    // ✅ Rate Limit Check
    await githubLimiter.checkLimit();

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ encrypted_value, key_id }),
      },
    );

    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(
        `Secret ${secretName} konnte nicht gesetzt werden (${putRes.status}): ${text}`,
      );
    }

    updated.push(secretName);
  }

  return { updated };
};

export const createRepo = async (repoName: string, isPrivate = true) => {
  const token = await getGitHubToken();
  if (!token)
    throw new Error("GitHub token fehlt. Bitte in Einstellungen eintragen.");

  // ✅ Rate Limit Check
  await githubLimiter.checkLimit();

  const resp = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: repoName, private: isPrivate }),
  });

  let json: any;
  try {
    json = await resp.json();
  } catch (e) {
    const textResponse = await resp.text();
    throw new Error(
      `GitHub API Fehler (Status ${resp.status}): Kein JSON empfangen. Antwort: ${textResponse}`,
    );
  }

  if (!resp.ok) {
    const status = resp.status;

    // ✅ Besseres Error Handling
    if (status === 401) {
      throw new Error(
        "GitHub Token ungültig. Bitte in Einstellungen neu eingeben.",
      );
    }
    if (status === 403) {
      throw new Error('Keine Berechtigung. Token benötigt "repo" Scope.');
    }

    const alreadyExistsError = json.errors?.find((e: any) =>
      e.message?.includes("name already exists"),
    );

    if (status === 422 && alreadyExistsError) {
      console.warn(`Repo '${repoName}' existiert bereits, verwende es.`);
      try {
        await githubLimiter.checkLimit();
        const userResp = await fetch("https://api.github.com/user", {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
          },
        });
        const userData = await userResp.json();
        if (!userData.login)
          throw new Error("Konnte User-Login nicht abrufen.");

        return {
          owner: { login: userData.login },
          name: repoName,
          html_url: `https://github.com/${userData.login}/${repoName}`,
        };
      } catch (userError: any) {
        throw new Error(
          `Repo existiert, aber Owner konnte nicht abgerufen werden: ${userError.message}`,
        );
      }
    }

    const errorDetails = JSON.stringify(json, null, 2);
    console.error("GitHub API Fehlerdetails:", errorDetails);
    throw new Error(
      `GitHub API Fehler (Status ${status}): ${json.message || errorDetails}`,
    );
  }

  return json;
};

/**
 * Löscht ein Repository.
 * Hinweis: GitHub API gibt bei Erfolg 204 zurück.
 */
export const deleteRepo = async (
  owner: string,
  repo: string,
): Promise<boolean> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
    },
  });

  if (resp.status === 204) return true;
  if (resp.status === 404) return false;

  const text = await resp.text();
  if (resp.status === 401) throw new Error("GitHub Token ungültig.");
  if (resp.status === 403)
    throw new Error("Keine Berechtigung. Token benötigt Repo-Admin Rechte.");
  throw new Error(`Repo löschen fehlgeschlagen (${resp.status}): ${text}`);
};

/**
 * Benennt ein Repository um.
 */
export const renameRepo = async (
  owner: string,
  repo: string,
  newName: string,
): Promise<{ full_name: string; name: string; html_url: string }> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const name = newName.trim();
  if (!name) throw new Error("Neuer Repo-Name ist leer.");

  await githubLimiter.checkLimit();

  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  const json: any = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error("Keine Berechtigung. Token benötigt Repo-Admin Rechte.");
    if (resp.status === 404) throw new Error("Repository nicht gefunden.");
    throw new Error(
      json.message || `Repo umbenennen fehlgeschlagen (${resp.status})`,
    );
  }

  return {
    full_name: json.full_name,
    name: json.name,
    html_url: json.html_url,
  };
};

/**
 * Erstellt einen Branch aus einem bestehenden Branch.
 */
export const createBranch = async (
  owner: string,
  repo: string,
  newBranch: string,
  fromBranch: string,
): Promise<boolean> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const branchName = newBranch.trim();
  if (!branchName) throw new Error("Branch-Name ist leer.");

  await githubLimiter.checkLimit();

  const refResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
      },
    },
  );

  const refJson: any = await refResp.json().catch(() => ({}));
  if (!refResp.ok) {
    if (refResp.status === 401) throw new Error("GitHub Token ungültig.");
    if (refResp.status === 403)
      throw new Error("Keine Berechtigung. Token benötigt Repo-Write Rechte.");
    throw new Error(
      refJson.message || `Base-Branch nicht gefunden: ${fromBranch}`,
    );
  }

  const sha = refJson?.object?.sha;
  if (!sha) throw new Error("Konnte SHA vom Base-Branch nicht ermitteln.");

  await githubLimiter.checkLimit();

  const createResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    },
  );

  const createJson: any = await createResp.json().catch(() => ({}));
  if (!createResp.ok) {
    if (createResp.status === 401) throw new Error("GitHub Token ungültig.");
    if (createResp.status === 403)
      throw new Error("Keine Berechtigung. Token benötigt Repo-Write Rechte.");
    throw new Error(
      createJson.message ||
        `Branch erstellen fehlgeschlagen (${createResp.status})`,
    );
  }

  return true;
};

/**
 * Löscht einen Branch.
 */
export const deleteBranch = async (
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const b = branch.trim();
  if (!b) throw new Error("Branch-Name ist leer.");

  await githubLimiter.checkLimit();

  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(b)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
      },
    },
  );

  if (resp.status === 204) return true;
  if (resp.status === 404) return false;

  const text = await resp.text();
  if (resp.status === 401) throw new Error("GitHub Token ungültig.");
  if (resp.status === 403)
    throw new Error(
      "Keine Berechtigung. Token benötigt Repo-Admin/Write Rechte.",
    );
  throw new Error(`Branch löschen fehlgeschlagen (${resp.status}): ${text}`);
};

/**
 * Benennt einen Branch um.
 * GitHub API: POST /repos/{owner}/{repo}/branches/{branch}/rename
 */
export const renameBranch = async (
  owner: string,
  repo: string,
  oldBranch: string,
  newBranch: string,
): Promise<{ name: string }> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const from = oldBranch.trim();
  const to = newBranch.trim();
  if (!from) throw new Error("Alter Branch-Name ist leer.");
  if (!to) throw new Error("Neuer Branch-Name ist leer.");

  await githubLimiter.checkLimit();

  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(from)}/rename`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ new_name: to }),
    },
  );

  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error(
        "Keine Berechtigung. Token benötigt Repo-Admin/Write Rechte.",
      );
    if (resp.status === 404)
      throw new Error("Branch oder Repo nicht gefunden.");
    throw new Error(
      json.message || `Branch umbenennen fehlgeschlagen (${resp.status})`,
    );
  }

  return { name: json.name || to };
};

export const createOrUpdateFile = async (
  owner: string,
  repo: string,
  path: string,
  content: string,
  message = "Add file",
  branch = "main",
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  // ✅ Rate Limit Check
  await githubLimiter.checkLimit();

  const getResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  let sha: string | undefined = undefined;
  if (getResp.ok) {
    const existing = await getResp.json();
    sha = existing.sha;
  }

  const body: any = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  // ✅ Rate Limit Check
  await githubLimiter.checkLimit();

  const putResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  let json: any;
  try {
    json = await putResp.json();
  } catch {
    const text = await putResp.text();
    throw new Error(
      `create/update file failed (${putResp.status}): ${path} -> ${text}`,
    );
  }

  if (!putResp.ok) {
    const status = putResp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Datei-Upload.");
    if (status === 404) throw new Error("Repository nicht gefunden.");
    throw new Error(json.message || `create/update file failed: ${path}`);
  }
  return json;
};

export const pushFilesToRepo = async (
  owner: string,
  repo: string,
  files: ProjectFile[],
  branch = "main",
) => {
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sortedFiles) {
    if (!f.path) continue;
    console.log(`Pushing ${f.path}...`);
    await createOrUpdateFile(
      owner,
      repo,
      f.path,
      f.content,
      `Add ${f.path}`,
      branch,
    );
  }
};

export const triggerWorkflow = async (
  owner: string,
  repo: string,
  workflowFileName = "eas-build.yml",
  ref = "main",
  inputs = {},
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  // ✅ Rate Limit Check
  await githubLimiter.checkLimit();

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/dispatches`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref, inputs }),
  });

  if (resp.status === 204) return { started: true };

  // ✅ Besseres Error Handling
  const status = resp.status;
  if (status === 401) throw new Error("GitHub Token ungültig.");
  if (status === 403)
    throw new Error("Keine Berechtigung für Workflow-Trigger.");
  if (status === 404) {
    throw new Error(
      `Workflow nicht gefunden. Stelle sicher, dass '${workflowFileName}' im '.github/workflows' Ordner auf GitHub (Branch 'main') existiert.`,
    );
  }

  const json = await resp.json();
  throw new Error(json.message || "workflow dispatch failed");
};

export const getWorkflowRuns = async (
  owner: string,
  repo: string,
  workflowFileName = "eas-build.yml",
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  // ✅ Rate Limit Check
  await githubLimiter.checkLimit();

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/runs?per_page=5`;
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  // ✅ Check Rate Limit Headers
  const remaining = resp.headers.get("X-RateLimit-Remaining");
  const reset = resp.headers.get("X-RateLimit-Reset");

  if (remaining && parseInt(remaining) < 100) {
    const resetDate = reset
      ? new Date(parseInt(reset) * 1000).toLocaleTimeString()
      : "unbekannt";
    console.warn(
      `⚠️ [GitHub API] Niedriges Rate Limit: ${remaining} Anfragen übrig. Reset: ${resetDate}`,
    );
  }

  const json = await resp.json();
  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403)
      throw new Error("Keine Berechtigung für Workflow-Abfrage.");
    if (status === 404)
      throw new Error("Workflow oder Repository nicht gefunden.");
    throw new Error(json.message || "get runs failed");
  }
  return json;
};

/**
 * Lädt alle Workflow Runs für ein Repo (über alle Workflows hinweg)
 */
export const getAllWorkflowRuns = async (
  owner: string,
  repo: string,
  perPage = 10,
): Promise<WorkflowRun[]> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`;
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung.");
    if (status === 404) throw new Error("Repository nicht gefunden.");
    const text = await resp.text();
    throw new Error(`Workflow Runs Fehler (${status}): ${text}`);
  }

  const json = await resp.json();
  return (json.workflow_runs || []) as WorkflowRun[];
};

export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  status: "queued" | "in_progress" | "completed" | "waiting";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

/**
 * Lädt alle Branches eines Repos
 */
export const getBranches = async (
  owner: string,
  repo: string,
): Promise<GitHubBranch[]> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`;
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung.");
    if (status === 404) throw new Error("Repository nicht gefunden.");
    const text = await resp.text();
    throw new Error(`Branches Fehler (${status}): ${text}`);
  }

  return (await resp.json()) as GitHubBranch[];
};

/**
 * Lädt den Default Branch eines Repos
 */
export const getDefaultBranch = async (
  owner: string,
  repo: string,
): Promise<string> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Repo-Info Fehler (${resp.status})`);
  }

  const json = await resp.json();
  return json.default_branch || "main";
};
