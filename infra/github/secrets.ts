import { githubLimiter } from "./rateLimit";
import { encryptSecret } from "./crypto";
import { ensureGitHubRepoParts } from "./utils";
import { getGitHubToken } from "./tokenStore";
import { githubApiUrl } from "../../shared/constants/github";
import { fetchGitHub } from "./utils";

export type RepoSecretsPayload = Partial<{
  expoToken: string | null | undefined;
  supabaseUrl: string | null | undefined;
  supabaseServiceRole: string | null | undefined;
  easProjectId: string | null | undefined;
  /** Optional legacy/shared admin secret for older Edge paths (x-k1w1-admin-key) */
  edgeAdminKey: string | null | undefined;
  /** Scoped workflow/admin secret for workflow-facing Edge Functions */
  workflowAdminKey: string | null | undefined;
  /** Scoped admin-only secret for android-keystore-export */
  androidKeystoreExportAdminKey: string | null | undefined;
}>;

const SECRET_NAME_MAP: Record<keyof RepoSecretsPayload, string> = {
  expoToken: "EXPO_TOKEN",
  supabaseUrl: "SUPABASE_URL",
  supabaseServiceRole: "SUPABASE_SERVICE_ROLE_KEY",
  easProjectId: "EAS_PROJECT_ID",
  edgeAdminKey: "K1W1_EDGE_ADMIN_KEY",
  workflowAdminKey: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
  androidKeystoreExportAdminKey: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
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
    throw new Error("GitHub Token fehlt – bitte im Verbindungen Screen setzen.");
  }

  const { owner, repo } = ensureGitHubRepoParts(repoFullName);
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  await githubLimiter.checkLimit();

  const keyRes = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/actions/secrets/public-key`),
    { headers },
  );

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
    throw new Error(`Public Key konnte nicht geladen werden (${status}): ${msg}`);
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

    await githubLimiter.checkLimit();

    const putRes = await fetchGitHub(
      githubApiUrl(`/repos/${owner}/${repo}/actions/secrets/${secretName}`),
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

export const listRepoSecretNames = async (
  owner: string,
  repo: string,
): Promise<string[]> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/actions/secrets?per_page=100`);
  const resp = await fetchGitHub(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Secrets read Fehler (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  const secrets = Array.isArray(json?.secrets) ? json.secrets : [];
  return secrets.map((s: any) => String(s?.name || "")).filter(Boolean);
};
