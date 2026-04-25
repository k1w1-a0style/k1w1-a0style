import {
  normalizeVerificationContract,
  type VerificationContractState,
} from "../../../lib/status/verificationContract";

export function formatGitHubScopes(scopesRaw?: string): { scopes: string[]; missing: string[]; unknown: boolean } {
  const raw = (scopesRaw || "").trim();
  if (!raw) return { scopes: [], missing: [], unknown: true };
  const scopes = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const uniq = Array.from(new Set(scopes)).sort((a, b) => a.localeCompare(b));

  // Classic PAT scopes we typically need for dispatch/reading workflows
  const required = ["repo", "workflow"];
  const missing = required.filter((r) => !uniq.includes(r));

  return { scopes: uniq, missing, unknown: false };
}

export function shouldRenderGitHubScopes(scopesRaw?: string): boolean {
  return !formatGitHubScopes(scopesRaw).unknown;
}

export function buildEasStatusDetail(params: {
  easInitRunning?: boolean;
  easProjectId?: string;
  easState?: VerificationContractState;
  easLastVerifiedAt?: string | null;
}): string {
  const easProjectId = String(params.easProjectId ?? "").trim();
  if (params.easInitRunning) return "Verknüpfung läuft… (GitHub Actions: eas-link)";
  if (!easProjectId) return "Keine EAS Project ID gespeichert.";
  if (params.easState === "verified") {
    if (params.easLastVerifiedAt) {
      const ts = new Date(params.easLastVerifiedAt);
      const readable = Number.isNaN(ts.getTime()) ? params.easLastVerifiedAt : ts.toLocaleString();
      return `Frisch verifiziert: ${readable}`;
    }
    return "Projekt-ID gespeichert, aber noch nicht frisch verifiziert.";
  }
  if (params.easState === "stale") {
    return "Projekt-ID vorhanden, aber der letzte erfolgreiche Check ist nicht mehr frisch.";
  }
  if (params.easState === "auth_error") {
    return "Projekt-ID vorhanden, aber Expo/EAS konnte sie mit diesem Login nicht bestaetigen.";
  }
  return "Projekt-ID vorhanden, aber aktuell nicht sicher verifizierbar.";
}

export function resolveEasVerificationPresentation(params: {
  easInitRunning?: boolean;
  easProjectId?: string;
  easState?: VerificationContractState | null;
  easLastVerifiedAt?: string | null;
}): {
  contractState: VerificationContractState;
  ok: boolean;
  stateLabel: string;
  stateTone: "ok" | "warn" | "neutral" | "error";
  detail: string;
} {
  const contract = normalizeVerificationContract({
    configured: !!String(params.easProjectId ?? "").trim(),
    stale: params.easState === "stale",
    verified: params.easState === "verified",
    explicitState: params.easState ?? undefined,
  });

  const stateLabel =
    contract.state === "verified"
      ? "OK"
      : contract.state === "missing"
        ? "FEHLT"
        : contract.state === "auth_error"
          ? "ZUGRIFF"
          : contract.state === "stale"
            ? "ALT"
            : "UNKLAR";

  const stateTone =
    contract.state === "verified"
      ? "ok"
      : contract.state === "missing"
        ? "error"
        : contract.state === "auth_error"
          ? "warn"
          : "neutral";

  return {
    contractState: contract.state,
    ok: contract.isVerified,
    stateLabel,
    stateTone,
    detail: buildEasStatusDetail({
      easInitRunning: params.easInitRunning,
      easProjectId: params.easProjectId,
      easState: contract.state,
      easLastVerifiedAt: params.easLastVerifiedAt,
    }),
  };
}

export function formatSupabaseDisplay(url: string, ref?: string): { value?: string; detail?: string } {
  const u = (url || "").trim();
  if (!u) return {};
  const host = u.replace(/^https?:\/\//i, "").split("/")[0] || u;

  const detectedRef = (ref || "").trim();
  if (detectedRef) {
    return {
      value: detectedRef,
      detail: `Host: ${host}`,
    };
  }

  const isSupabaseCo = /\.supabase\.co$/i.test(host);
  return {
    value: host,
    detail: isSupabaseCo ? "Ref konnte nicht erkannt werden." : "Custom Domain (Ref unbekannt).",
  };
}
