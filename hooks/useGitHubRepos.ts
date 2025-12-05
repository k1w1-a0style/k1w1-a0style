// hooks/useGitHubRepos.ts - Custom hook for GitHub repository management
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Buffer } from 'buffer';
import { ProjectFile } from '../contexts/types';

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description?: string | null;
  updated_at: string;
};

// Retry helper for API calls
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);

      if (res.ok || res.status === 404 || res.status === 403) {
        return res;
      }

      if (res.status >= 500 && i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }

      return res;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }

  throw new Error('Max retries reached');
}

export const useGitHubRepos = (token: string | null) => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    if (!token) {
      Alert.alert(
        'Kein Token',
        'Bitte hinterlege dein GitHub-PAT im „Verbindungen"-Screen.'
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetchWithRetry(
        'https://api.github.com/user/repos?per_page=100&sort=updated',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `token ${token}`,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub-API Fehler (${res.status}): ${text}`);
      }

      const json = (await res.json()) as GitHubRepo[];
      setRepos(json);
    } catch (e: any) {
      console.error('[useGitHubRepos] Error:', e);
      setError(e?.message ?? 'Fehler beim Laden der Repos');
      Alert.alert('Fehler', 'Repos konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const deleteRepo = useCallback(
    async (repo: GitHubRepo) => {
      if (!token) return;

      try {
        const res = await fetchWithRetry(
          `https://api.github.com/repos/${repo.full_name}`,
          {
            method: 'DELETE',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `token ${token}`,
            },
          }
        );

        if (res.status === 403) {
          Alert.alert(
            'Keine Rechte',
            'Du brauchst Admin-Rechte + delete_repo-Scope.'
          );
          return false;
        }

        if (res.status !== 204) {
          throw new Error(`Status ${res.status}`);
        }

        setRepos((prev) => prev.filter((r) => r.full_name !== repo.full_name));
        return true;
      } catch (e: any) {
        console.error('[useGitHubRepos] Delete error:', e);
        Alert.alert('Fehler', e?.message ?? 'Repo konnte nicht gelöscht werden.');
        return false;
      }
    },
    [token]
  );

  const renameRepo = useCallback(
    async (currentFullName: string, newName: string) => {
      if (!token) return null;

      try {
        const res = await fetchWithRetry(
          `https://api.github.com/repos/${currentFullName}`,
          {
            method: 'PATCH',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `token ${token}`,
            },
            body: JSON.stringify({ name: newName }),
          }
        );

        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }

        const [owner] = currentFullName.split('/');
        const newFullName = `${owner}/${newName}`;

        setRepos((prev) =>
          prev.map((r) =>
            r.full_name === currentFullName
              ? { ...r, name: newName, full_name: newFullName }
              : r
          )
        );

        return newFullName;
      } catch (e: any) {
        console.error('[useGitHubRepos] Rename error:', e);
        Alert.alert('Fehler', e?.message ?? 'Repo konnte nicht umbenannt werden.');
        return null;
      }
    },
    [token]
  );

  const pullFromRepo = useCallback(
    async (
      owner: string,
      repo: string,
      onProgress?: (message: string) => void
    ): Promise<ProjectFile[] | null> => {
      if (!token) return null;

      try {
        const headers = {
          Accept: 'application/vnd.github+json',
          Authorization: `token ${token}`,
        };

        onProgress?.('Lade Repo-Info...');

        const infoRes = await fetchWithRetry(
          `https://api.github.com/repos/${owner}/${repo}`,
          { headers }
        );

        if (!infoRes.ok) {
          throw new Error(`Repo nicht gefunden (${infoRes.status})`);
        }

        const infoJson = await infoRes.json();
        const branch = infoJson.default_branch || 'main';

        onProgress?.(`Lade Dateibaum (Branch: ${branch})...`);

        const treeRes = await fetchWithRetry(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
          { headers }
        );

        if (!treeRes.ok) {
          throw new Error(`Tree-Abruf fehlgeschlagen (${treeRes.status})`);
        }

        const treeJson = await treeRes.json();

        if (!treeJson?.tree || !Array.isArray(treeJson.tree)) {
          throw new Error('Ungültige Baum-Struktur');
        }

        const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml', '.config.js'];
        const files: ProjectFile[] = [];

        const treeEntries = treeJson.tree.filter((entry: any) => entry.type === 'blob');

        if (!treeEntries.length) {
          Alert.alert('Keine Dateien', 'Im Repository wurden keine Dateien gefunden.');
          return [];
        }

        onProgress?.(`Lade Dateien (${treeEntries.length})...`);

        const BATCH_SIZE = 10;
        for (let i = 0; i < treeEntries.length; i += BATCH_SIZE) {
          const batch = treeEntries.slice(i, i + BATCH_SIZE);
          onProgress?.(
            `Lade Dateien ${i + 1}-${Math.min(i + BATCH_SIZE, treeEntries.length)} von ${treeEntries.length}...`
          );

          const results = await Promise.allSettled(
            batch.map(async (entry: any) => {
              const path = entry.path;
              const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';

              if (!textExtensions.includes(ext)) {
                console.log(`[useGitHubRepos] Skip binary: ${path}`);
                return null;
              }

              try {
                const res = await fetchWithRetry(
                  `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
                  { headers }
                );

                if (!res.ok) return null;

                const json = await res.json();
                const content =
                  json.encoding === 'base64'
                    ? Buffer.from(String(json.content || '').replace(/\n/g, ''), 'base64').toString('utf8')
                    : json.content || '';

                return { path, content };
              } catch {
                return null;
              }
            })
          );

          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              files.push(result.value);
            }
          });
        }

        if (files.length === 0) {
          Alert.alert('Keine Dateien', 'Im Repository wurden keine Text-Dateien gefunden.');
          return [];
        }

        return files;
      } catch (e: any) {
        console.error('[useGitHubRepos] Pull error:', e);
        Alert.alert('Pull fehlgeschlagen', e?.message ?? 'Fehler beim Laden der Dateien.');
        return null;
      }
    },
    [token]
  );

  return {
    repos,
    loading,
    error,
    loadRepos,
    deleteRepo,
    renameRepo,
    pullFromRepo,
  };
};
