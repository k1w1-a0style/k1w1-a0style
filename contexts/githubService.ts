// contexts/githubService.ts - simplified token handling + repo secrets sync

// ✅ FIX: SecureStore für sensitive Tokens statt AsyncStorage
import * as SecureStore from 'expo-secure-store';
import sodium from 'tweetsodium';
import { Buffer } from 'buffer';
import { ProjectFile } from './types';
import { RateLimiter } from '../lib/RateLimiter';

// ✅ FIX: Buffer Polyfill Check
if (typeof Buffer === 'undefined') {
  throw new Error(
    '❌ Buffer polyfill fehlt. Bitte "buffer" Package installieren: npm install buffer'
  );
}

const GH_TOKEN_KEY = 'github_pat_v1';
const EXPO_TOKEN_KEY = 'expo_token_v1';

// ✅ FIX: Rate Limiter für GitHub API (5000/hour, wir nutzen 4000 als Buffer)
const githubLimiter = new RateLimiter({ 
  maxRequests: 4000, 
  windowMs: 3600000 // 1 hour
});

type RepoSecretsPayload = Partial<{
  expoToken: string | null | undefined;
  supabaseUrl: string | null | undefined;
  supabaseServiceRole: string | null | undefined;
}>;

const SECRET_NAME_MAP: Record<keyof RepoSecretsPayload, string> = {
  expoToken: 'EXPO_TOKEN',
  supabaseUrl: 'SUPABASE_URL',
  supabaseServiceRole: 'SUPABASE_SERVICE_ROLE_KEY',
};

// ✅ FIX: SecureStore Wrapper-Funktionen (verschlüsselt!)
const saveSecureToken = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error: any) {
    console.error(`[SecureStore] Fehler beim Speichern von ${key}:`, error);
    throw new Error(`Token konnte nicht sicher gespeichert werden: ${error.message}`);
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
  const keyBytes = Buffer.from(publicKey, 'base64');
  const encryptedBytes = sodium.seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString('base64');
};

const ensureGitHubRepoParts = (fullName: string): { owner: string; repo: string } => {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Ungültiges Repo-Format: ${fullName}`);
  }
  return { owner, repo };
};

/**
 * Speichert GitHub Token (plain AsyncStorage)
 */
export const saveGitHubToken = async (token: string): Promise<void> => {
  await savePlainToken(GH_TOKEN_KEY, token);
  console.log('✅ GitHub Token gespeichert (plain).');
};

/**
 * Lädt GitHub Token
 */
export const getGitHubToken = async (): Promise<string | null> => {
  return getPlainToken(GH_TOKEN_KEY);
};

/**
 * Speichert Expo Token
 */
export const saveExpoToken = async (token: string): Promise<void> => {
  await savePlainToken(EXPO_TOKEN_KEY, token);
  console.log('✅ Expo Token gespeichert (plain).');
};

/**
 * Lädt Expo Token
 */
export const getExpoToken = async (): Promise<string | null> => {
  return getPlainToken(EXPO_TOKEN_KEY);
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
  await deletePlainToken(GH_TOKEN_KEY);
};

/**
 * Löscht Expo Token
 */
export const deleteExpoToken = async (): Promise<void> => {
  await deletePlainToken(EXPO_TOKEN_KEY);
};

/**
 * Synchronisiert Secrets (Expo/Supabase) mit dem aktiven GitHub-Repo.
 */
export const syncRepoSecrets = async (
  repoFullName: string,
  payload: RepoSecretsPayload,
): Promise<{ updated: string[] }> => {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error('GitHub Token fehlt – bitte im Verbindungen Screen setzen.');
  }

  const { owner, repo } = ensureGitHubRepoParts(repoFullName);
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  };

  const keyRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
    { headers },
  );

  if (!keyRes.ok) {
    const msg = await keyRes.text();
    throw new Error(`Public Key konnte nicht geladen werden (${keyRes.status}): ${msg}`);
  }

  const { key, key_id } = await keyRes.json();
  if (!key || !key_id) {
    throw new Error('GitHub Public Key Antwort unvollständig.');
  }

  const updated: string[] = [];

  for (const [field, secretName] of Object.entries(SECRET_NAME_MAP)) {
    const value = payload[field as keyof RepoSecretsPayload];
    if (!value) continue;

    const encrypted_value = encryptSecret(key, value);
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
      {
        method: 'PUT',
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
  if (!token) throw new Error('GitHub token fehlt. Bitte in Einstellungen eintragen.');

  const resp = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: repoName, private: isPrivate }),
  });

  let json: any;
  try {
    json = await resp.json();
  } catch (e) {
    const textResponse = await resp.text();
    throw new Error(`GitHub API Fehler (Status ${resp.status}): Kein JSON empfangen. Antwort: ${textResponse}`);
  }

  if (!resp.ok) {
    const alreadyExistsError = json.errors?.find((e: any) =>
      e.message?.includes('name already exists')
    );

    if (resp.status === 422 && alreadyExistsError) {
      console.warn(`Repo '${repoName}' existiert bereits, verwende es.`);
      try {
        const userResp = await fetch('https://api.github.com/user', {
          headers: { Authorization: `token ${token}` },
        });
        const userData = await userResp.json();
        if (!userData.login) throw new Error('Konnte User-Login nicht abrufen.');

        return { 
          owner: { login: userData.login }, 
          name: repoName, 
          html_url: `https://github.com/${userData.login}/${repoName}` 
        };
      } catch (userError: any) {
        throw new Error(`Repo existiert, aber Owner konnte nicht abgerufen werden: ${userError.message}`);
      }
    }

    const errorDetails = JSON.stringify(json, null, 2);
    console.error('GitHub API Fehlerdetails:', errorDetails);
    throw new Error(`GitHub API Fehler (Status ${resp.status}): ${json.message || errorDetails}`);
  }

  return json;
};

export const createOrUpdateFile = async (
  owner: string, 
  repo: string, 
  path: string, 
  content: string, 
  message = 'Add file'
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error('GitHub token fehlt.');
  
  const getResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, 
    { headers: { Authorization: `token ${token}` } }
  );
  
  let sha: string | undefined = undefined;
  if (getResp.ok) {
    const existing = await getResp.json();
    sha = existing.sha;
  }
  
  const body: any = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: 'main',
  };
  if (sha) body.sha = sha;
  
  const putResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, 
    {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  
  const json = await putResp.json();
  if (!putResp.ok) throw new Error(json.message || `create/update file failed: ${path}`);
  return json;
};

export const pushFilesToRepo = async (owner: string, repo: string, files: ProjectFile[]) => {
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sortedFiles) {
    if (!f.path) continue;
    console.log(`Pushing ${f.path}...`);
    await createOrUpdateFile(owner, repo, f.path, f.content, `Add ${f.path}`);
  }
};

export const triggerWorkflow = async (
  owner: string, 
  repo: string, 
  workflowFileName = 'eas-build.yml', 
  ref = 'main', 
  inputs = {}
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error('GitHub token fehlt.');
  
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/dispatches`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, inputs }),
  });
  
  if (resp.status === 204) return { started: true };
  if (resp.status === 404) {
    throw new Error(
      `Workflow nicht gefunden. Stelle sicher, dass '${workflowFileName}' im '.github/workflows' Ordner auf GitHub (Branch 'main') existiert.`
    );
  }
  
  const json = await resp.json();
  throw new Error(json.message || 'workflow dispatch failed');
};

export const getWorkflowRuns = async (
  owner: string, 
  repo: string, 
  workflowFileName = 'eas-build.yml'
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error('GitHub token fehlt.');
  
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/runs?per_page=5`;
  const resp = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.message || 'get runs failed');
  return json;
};
