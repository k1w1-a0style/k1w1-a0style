import { isLikelyWellFormedAdminKeyForUiPrecheck } from "../../../lib/security/isLikelyWellFormedAdminKeyForUiPrecheck";

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
  if (!isLikelyWellFormedAdminKeyForUiPrecheck(trimmedKey)) return "invalid";

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
  surface?: "generic" | "keystore";
}): string | undefined {
  const surface = params.surface ?? "generic";
  const keyName =
    surface === "keystore"
      ? "Lokaler Android Keystore Export Admin Key"
      : "Lokaler Legacy Edge Admin Key (compat, Sunset)";
  const kind = inferLocalEdgeAdminKeyIssueKind(params);
  if (kind === "missing") {
    return surface === "keystore"
      ? `${keyName} fehlt. Repo-/Server-Secrets koennen vorhanden sein, aber der Wizard braucht diesen lokalen App-Wert fuer geschuetzte Keystore-Edge-Calls.`
      : `${keyName} fehlt. Repo-/Server-Secrets koennen vorhanden sein, aber Wizard, Remote-Preview und Build-Vorbereitung brauchen diesen lokalen App-Wert fuer geschuetzte Edge-Calls.`;
  }
  if (kind === "invalid") {
    return `${keyName} wirkt ungueltig (leer/zu kurz/Whitespace). Bitte in der App neu speichern oder importieren.`;
  }
  if (kind === "rejected") {
    return surface === "keystore"
      ? `${keyName} ist lokal vorhanden und wurde fuer den geschuetzten Keystore-Edge-Request verwendet, aber vom Edge-Server abgelehnt (401/403 bzw. invalid admin). Bitte den lokalen App-Key neu speichern oder korrekt importieren.`
      : `${keyName} ist lokal vorhanden und wurde fuer den geschuetzten Edge-Request verwendet, aber vom Edge-Server abgelehnt (401/403 bzw. invalid admin). Bitte den lokalen App-Key neu speichern oder korrekt importieren.`;
  }
  if (kind === "unknown") {
    return surface === "keystore"
      ? `Keystore-Status konnte nicht sicher verifiziert werden. Wenn Repo-/Server-Secrets vorhanden sind, pruefe zuerst den ${keyName.toLowerCase()} in der App.`
      : `Edge-Status konnte nicht sicher verifiziert werden. Wenn Repo-/Server-Secrets vorhanden sind, pruefe zuerst den ${keyName.toLowerCase()} in der App.`;
  }
  return undefined;
}
