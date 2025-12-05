// contexts/githubService.ts - ✅ SICHER mit SecureTokenManager

import { Buffer } from 'buffer';
import { ProjectFile } from './types';
import SecureTokenManager from '../lib/SecureTokenManager';

// Token-Keys (bleiben für Kompatibilität gleich)
const GH_TOKEN_KEY = 'github_pat_v1';
const EXPO_TOKEN_KEY = 'expo_token_v1';

// ✅ SICHERHEIT: Token-Expiry für GitHub (30 Tage)
const GITHUB_TOKEN_EXPIRY_DAYS = 30;

// ✅ SICHERHEIT: Token-Expiry für Expo (90 Tage)
const EXPO_TOKEN_EXPIRY_DAYS = 90;

/**
 * Speichert GitHub Token mit Verschlüsselung und Expiry
 */
export const saveGitHubToken = async (token: string): Promise<void> => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + GITHUB_TOKEN_EXPIRY_DAYS);
  
  await SecureTokenManager.saveToken(GH_TOKEN_KEY, token, expiresAt);
  console.log(`✅ GitHub Token gespeichert (gültig bis ${expiresAt.toISOString()})`);
};

/**
 * Lädt GitHub Token (prüft automatisch Expiry)
 */
export const getGitHubToken = async (): Promise<string | null> => {
  return await SecureTokenManager.getToken(GH_TOKEN_KEY);
};

/**
 * Speichert Expo Token mit Verschlüsselung und Expiry
 */
export const saveExpoToken = async (token: string): Promise<void> => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPO_TOKEN_EXPIRY_DAYS);
  
  await SecureTokenManager.saveToken(EXPO_TOKEN_KEY, token, expiresAt);
  console.log(`✅ Expo Token gespeichert (gültig bis ${expiresAt.toISOString()})`);
};

/**
 * Lädt Expo Token (prüft automatisch Expiry)
 */
export const getExpoToken = async (): Promise<string | null> => {
  return await SecureTokenManager.getToken(EXPO_TOKEN_KEY);
};

/**
 * Prüft ob GitHub Token vorhanden und gültig ist
 */
export const hasValidGitHubToken = async (): Promise<boolean> => {
  return await SecureTokenManager.hasValidToken(GH_TOKEN_KEY);
};

/**
 * Prüft ob Expo Token vorhanden und gültig ist
 */
export const hasValidExpoToken = async (): Promise<boolean> => {
  return await SecureTokenManager.hasValidToken(EXPO_TOKEN_KEY);
};

/**
 * Löscht GitHub Token
 */
export const deleteGitHubToken = async (): Promise<void> => {
  await SecureTokenManager.deleteToken(GH_TOKEN_KEY);
};

/**
 * Löscht Expo Token
 */
export const deleteExpoToken = async (): Promise<void> => {
  await SecureTokenManager.deleteToken(EXPO_TOKEN_KEY);
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
