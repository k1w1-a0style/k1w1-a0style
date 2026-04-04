import { githubApiUrl } from "../../../shared/constants/github";
import { fetchWithTimeout } from "../../../lib/network/fetchWithTimeout";
import { parseExpoGraphQLUsername } from "../utils/expoGraphql";
import { deriveSupabaseRefFromUrl, type ExpoProjectResponse } from "./useConnectionsScreenHelpers";

export type GitHubConnectionCheckResult = {
  login: string;
  scopes: string;
  status: number;
};

export const runGitHubConnectionCheck = async (token: string): Promise<GitHubConnectionCheckResult> => {
  const resp = await fetchWithTimeout(githubApiUrl("/user"), {
    timeoutMs: 12_000,
    timeoutMessage: "GitHub-Test hat das Zeitlimit erreicht. Bitte erneut versuchen.",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.trim()}`,
    },
  });
  if (!resp.ok) throw new Error(`GitHub Test failed (${resp.status})`);
  const userData = await resp.json().catch(() => ({}));
  const scopesHeader = resp.headers.get("x-oauth-scopes") || resp.headers.get("X-OAuth-Scopes") || "";
  return {
    login: userData?.login || "",
    scopes: String(scopesHeader || "").trim(),
    status: resp.status,
  };
};

export type ExpoConnectionCheckResult = {
  username: string;
  raw: string;
  status: number;
  ok: boolean;
};

export const runExpoConnectionCheck = async (token: string): Promise<ExpoConnectionCheckResult> => {
  const resp = await fetchWithTimeout("https://api.expo.dev/graphql", {
    timeoutMs: 12_000,
    timeoutMessage: "Expo-Test hat das Zeitlimit erreicht. Bitte erneut versuchen.",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.trim()}`,
    },
    body: JSON.stringify({
      query: "query Me { me { id username } }",
    }),
  });
  const raw = await resp.text();
  if (!resp.ok) throw new Error(`Expo Test failed (${resp.status})`);
  return {
    username: parseExpoGraphQLUsername(raw || ""),
    raw,
    status: resp.status,
    ok: resp.ok,
  };
};

export type SupabaseConnectionCheckResult =
  | { kind: "ok"; ref: string }
  | { kind: "rls_protected" };

export const runSupabaseConnectionCheck = async (
  url: string,
  anon: string,
): Promise<SupabaseConnectionCheckResult> => {
  const resp = await fetchWithTimeout(`${url}/rest/v1/`, {
    timeoutMs: 12_000,
    timeoutMessage: "Supabase-REST-Ping hat das Zeitlimit erreicht. Bitte URL/Netzwerk prüfen.",
    method: "GET",
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  if (!resp.ok) throw new Error(`REST Ping failed (${resp.status})`);

  const tableRes = await fetchWithTimeout(`${url}/rest/v1/build_jobs?select=id&limit=1`, {
    timeoutMs: 12_000,
    timeoutMessage: "Supabase build_jobs-Prüfung hat das Zeitlimit erreicht. Bitte erneut versuchen.",
    method: "GET",
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });

  if (!tableRes.ok) {
    if (tableRes.status === 401 || tableRes.status === 403) {
      return { kind: "rls_protected" };
    }
    throw new Error(`build_jobs Check fehlgeschlagen (${tableRes.status}).`);
  }

  return { kind: "ok", ref: deriveSupabaseRefFromUrl(url) };
};

export const runEasProjectCheck = async (
  easProjectId: string,
  expoToken: string,
): Promise<{ ok: boolean; status: number; json: ExpoProjectResponse | null }> => {
  const id = easProjectId.trim();
  const resp = await fetchWithTimeout(`https://api.expo.dev/v2/projects/${encodeURIComponent(id)}`, {
    timeoutMs: 12_000,
    timeoutMessage: "EAS-Projektprüfung hat das Zeitlimit erreicht. Bitte Expo-Verbindung erneut testen.",
    headers: {
      Authorization: `Bearer ${expoToken.trim()}`,
      Accept: "application/json",
    },
  });

  return {
    ok: resp.ok,
    status: resp.status,
    json: (await resp.json().catch(() => null)) as ExpoProjectResponse | null,
  };
};
