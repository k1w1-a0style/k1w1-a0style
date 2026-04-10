export function redactPreviewUrl(raw: string | null | undefined): string {
  if (!raw) return "Preview-Link ausgeblendet";

  try {
    const parsed = new URL(raw);
    const host = parsed.host;
    const path = parsed.pathname || "/";
    const hasQuery = parsed.search.length > 0;
    const hasFragment = parsed.hash.length > 0;
    const queryHint = hasQuery ? "?••••" : "";
    const fragmentHint = hasFragment ? "#secret=••••" : "";
    return `${host}${path}${queryHint}${fragmentHint}`;
  } catch {
    return "Preview-Link mit Secret (aus Sicherheitsgruenden ausgeblendet)";
  }
}
