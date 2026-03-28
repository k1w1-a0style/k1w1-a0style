import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";

const MAX_ALERT_CHARS = 180;

export const safeAlertText = (value: unknown, fallback = "Fehler"): string => {
  const raw = typeof value === "string" ? value : (value as any)?.message;
  const msg = String(raw || fallback);
  return truncateWithMarker(redactSecrets(msg), MAX_ALERT_CHARS, "…<gekürzt>");
};

export const looksLikeJwt = (token: string): boolean => {
  // Minimal check only. We don't decode here to avoid atob / platform edge cases.
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; title: string; message: string };

export const validateEasProjectId = (easProjectId?: string): ValidationResult => {
  const normalized = easProjectId?.trim() ?? "";
  if (!normalized) return { ok: true };

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized,
    );

  if (isUuid) return { ok: true };

  return {
    ok: false,
    title: "Ungültige EAS Project ID",
    message: "Die EAS Project ID muss eine UUID im Format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx sein.",
  };
};

export const validateBeforeSave = (p: {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  legacyEdgeAdminKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId?: string;
}): ValidationResult => {
  const gh = p.githubToken.trim();
  if (gh) {
    const okPrefix =
      gh.startsWith("ghp_") || gh.startsWith("github_pat_") || gh.startsWith("gho_");
    const okLength = gh.length >= 30;
    if (!okPrefix || !okLength) {
      return {
        ok: false,
        title: "Ungültiger GitHub Token",
        message: 'GitHub PAT muss typischerweise mit "ghp_" oder "github_pat_" beginnen.',
      };
    }
  }

  const ex = p.expoToken.trim();
  if (ex) {
    // Expo tokens vary; we only prevent obvious junk (too short / whitespace).
    if (ex.length < 20 || /\s/.test(ex)) {
      return {
        ok: false,
        title: "Ungültiger Expo/EAS Token",
        message: "Token ist zu kurz oder enthält Leerzeichen.",
      };
    }
  }

  const validateScopedAdminKey = (
    rawValue: string,
    title: string,
    message: string,
  ): ValidationResult => {
    const value = rawValue.trim();
    if (!value) return { ok: true };
    if (value.length < 20 || /\s/.test(value)) {
      return { ok: false, title, message };
    }
    return { ok: true };
  };

  const workflowKeyValidation = validateScopedAdminKey(
    p.workflowAdminKey,
    "Ungültiger lokaler Workflow Admin Key",
    "Workflow-Key ist zu kurz oder enthält Leerzeichen.",
  );
  if (!workflowKeyValidation.ok) return workflowKeyValidation;

  const keystoreKeyValidation = validateScopedAdminKey(
    p.androidKeystoreExportAdminKey,
    "Ungültiger lokaler Keystore Export Admin Key",
    "Keystore-Export-Key ist zu kurz oder enthält Leerzeichen.",
  );
  if (!keystoreKeyValidation.ok) return keystoreKeyValidation;

  const legacyKeyValidation = validateScopedAdminKey(
    p.legacyEdgeAdminKey,
    "Ungültiger lokaler Legacy Edge Admin Key",
    "Legacy-Key ist zu kurz oder enthält Leerzeichen.",
  );
  if (!legacyKeyValidation.ok) return legacyKeyValidation;

  const sbUrl = p.supabaseUrl.trim();
  if (sbUrl) {
    if (!/^https:\/\//i.test(sbUrl) || !/\.supabase\.co\b/i.test(sbUrl)) {
      return {
        ok: false,
        title: "Ungültige Supabase URL",
        message: "URL muss https://<project>.supabase.co sein.",
      };
    }
  }

  const anon = p.supabaseAnonKey.trim();
  if (anon && !looksLikeJwt(anon)) {
    return {
      ok: false,
      title: "Ungültiger Supabase ANON Key",
      message: "Key muss wie ein JWT aussehen (eyJ... . eyJ... . ...).",
    };
  }

  return validateEasProjectId(p.easProjectId);
};

export const deriveSupabaseUrl = (raw: string): { projectId: string; url: string } => {
  const trimmed = (raw || "").trim();

  const matchUrl = trimmed.match(/^https?:\/\/([^.]+)\.supabase\.co/i);
  if (matchUrl && matchUrl[1]) {
    const id = matchUrl[1];
    return { projectId: id, url: `https://${id}.supabase.co` };
  }

  const matchId = trimmed.match(/^[a-z0-9]{6,}$/i);
  if (matchId) {
    const id = trimmed;
    return { projectId: id, url: `https://${id}.supabase.co` };
  }

  return { projectId: "", url: "" };
};
