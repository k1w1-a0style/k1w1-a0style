import { isLikelyValidAdminKey } from "./security";

export type LocalEdgeAdminKeyIssueKind = "missing" | "invalid" | "rejected" | "unknown" | null;

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : String(error ?? "");
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

  if (
    message.includes("missing edge admin key") ||
    message.includes("missing or invalid admin") ||
    message.includes("admin key fehlt")
  ) {
    return "missing";
  }

  if (
    params.statusCode === 401 ||
    params.statusCode === 403 ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid admin") ||
    message.includes("admin key") ||
    message.includes("x-k1w1-admin-key")
  ) {
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
    return "Lokaler Edge Admin Key wurde vom Edge-Server abgelehnt (401/403). Repo-/Server-Secrets koennen trotzdem vorhanden sein; bitte den lokalen App-Key neu speichern oder korrekt importieren.";
  }
  if (kind === "unknown") {
    return "Edge-Status konnte nicht sicher verifiziert werden. Wenn Repo-/Server-Secrets vorhanden sind, pruefe zuerst den lokalen Edge Admin Key in der App.";
  }
  return undefined;
}
