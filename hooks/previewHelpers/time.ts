export function isPreviewExpired(expiresAt: string | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() <= now.getTime();
}

export function formatPreviewExpiry(expiresAt: string | null, now = new Date()): string {
  if (!expiresAt) return "Kein Ablauf hinterlegt (letzter bekannter Stand)";

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return "Ablaufzeit konnte nicht gelesen werden";

  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return "Abgelaufen – letzte URL wird nicht mehr geladen, bitte neu erstellen";

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `Gültig für ca. ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Gültig für ca. ${hours} h`;

  const days = Math.round(hours / 24);
  return `Gültig für ca. ${days} Tage`;
}

export function getPreviewChannelLabel(source: "supabase" | "local" | null): string {
  if (source === "supabase") return "Primäre Remote-Preview (Supabase / Browser)";
  if (source === "local") return "Lokaler HTML-/Eval-Fallback (nur Dev/Best-Effort, nur solange App aktiv ist)";
  return "Noch keine Preview aktiv";
}

export function getPreviewMixedContentMode(): "never" {
  return "never";
}
