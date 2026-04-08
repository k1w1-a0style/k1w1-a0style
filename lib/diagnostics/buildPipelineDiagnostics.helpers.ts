import type { DiagnosticCheck } from "./diagnosticTypes";

export function getDiagnosticErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed || fallback;
  }
  return fallback;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readStringDeps(value: unknown): Record<string, string> {
  const record = asRecord(value);
  if (!record) return {};
  const entries = Object.entries(record).filter(([, dep]) => typeof dep === "string") as Array<[string, string]>;
  return Object.fromEntries(entries);
}

export function getRepoSecretCheckTitle(params: {
  name: string;
  state: "verified" | "missing" | "unknown" | "auth_error" | "stale";
}): string {
  if (params.state === "verified") return `Repo Secret bestätigt: ${params.name}`;
  if (params.state === "missing") return `Repo Secret fehlt: ${params.name}`;
  if (params.state === "auth_error") return `Repo Secret Zugriff unklar: ${params.name}`;
  if (params.state === "stale") return `Repo Secret Status veraltet: ${params.name}`;
  return `Repo Secret Status unklar: ${params.name}`;
}

export function describeRepoSecretContract(params: {
  name: string;
  state: "verified" | "missing" | "unknown" | "auth_error" | "stale";
  optional?: boolean;
}): { status: DiagnosticCheck["status"]; fixHint?: string } {
  if (params.state === "verified") return { status: "pass" };
  if (params.state === "missing") {
    return {
      status: params.optional ? "warn" : "fail",
      fixHint: params.optional
        ? `Optional, aber fuer Remote-Checks hilfreich: ${params.name} fehlt im Repo.`
        : `Secretsync ausführen (${params.name} fehlt).`,
    };
  }
  if (params.state === "auth_error") {
    return {
      status: "warn",
      fixHint: `Secret-Zugriff fuer ${params.name} konnte nicht verifiziert werden: GitHub Token braucht Repo-Admin-/Secrets-Rechte.`,
    };
  }
  if (params.state === "stale") {
    return {
      status: "warn",
      fixHint: `Secret-Status fuer ${params.name} ist nicht mehr frisch bestaetigt. Bitte Repo-Secrets erneut prüfen.`,
    };
  }
  return {
    status: "warn",
    fixHint: `Secret-Status fuer ${params.name} ist aktuell unklar und konnte nicht sicher verifiziert werden.`,
  };
}
