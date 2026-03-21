import { isLikelyValidAdminKey } from "./security";

export type LocalEdgeAdminKeyIssueKind = "missing" | "invalid" | "rejected" | "unknown" | null;

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : String(error ?? "");
}

function isAdminKeyAuthFailure(params: { statusCode?: number | null; message: string }): boolean {
  return (
    params.statusCode === 401 ||
    params.statusCode === 403 ||
    params.message.includes("401") ||
    params.message.includes("403") ||
    params.message.includes("missing edge admin key") ||
    params.message.includes("missing or invalid admin") ||
    params.message.includes("invalid admin") ||
    params.message.includes("admin key fehlt") ||
    params.message.includes("unauthorized") ||
    params.message.includes("forbidden") ||
    params.message.includes("x-k1w1-admin-key") ||
    params.message.includes("authorization") ||
    params.message.includes("bearer")
  );
}

export function inferLocalEdgeAdminKeyIssueKind(params: {
  adminKey?: string | null;
  statusCode?: number | null;
  error?: unknown;
}): LocalEdgeAdminKeyIssueKind {
  const trimmedKey = String(params.adminKey ?? "").trim();
  if (!trimmedKey) return "missing";
  if (!isLikelyValidAdminKey(trimmedKey)) return "invalid";

  const message = toMessage(params.error).toLowerCase();
  if (isAdminKeyAuthFailure({ statusCode: params.statusCode, message })) {
    return "rejected";
  }

  return message ? "unknown" : null;
}

export function describeLocalEdgeAdminKeyIssue(params: {
  adminKey?: string | null;
  statusCode?: number | null;
  error?: unknown;
}): string | undefined {
  const kind = inferLocalEdgeAdminKeyIssueKind(params);
  if (kind === "missing") {
    return "Lokaler Edge Admin Key fehlt. Repo-/Server-Secrets koennen vorhanden sein, aber Wizard, Remote-Preview und Build-Vorbereitung brauchen diesen lokalen App-Wert fuer geschuetzte Edge-Calls.";
  }
  if (kind === "invalid") {
    return "Lokaler Edge Admin Key wirkt ungueltig (leer/zu kurz/Whitespace). Bitte in der App neu speichern oder importieren.";
  }
  if (kind === "rejected") {
    return "Lokaler Edge Admin Key ist lokal vorhanden und wurde fuer den geschuetzten Edge-Request verwendet, aber vom Edge-Server abgelehnt (401/403 bzw. invalid admin). Bitte den lokalen App-Key neu speichern oder korrekt importieren.";
  }
  if (kind === "unknown") {
    return "Edge-Status konnte nicht sicher verifiziert werden. Wenn Repo-/Server-Secrets vorhanden sind, pruefe zuerst den lokalen Edge Admin Key in der App.";
  }
  return undefined;
}
