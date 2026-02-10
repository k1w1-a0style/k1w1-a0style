// utils/previewNavigation.ts
// Pure navigation decision logic for the PreviewFullscreen WebView.
// This is intentionally free of React Native side-effects (Alert/Linking) so it can be unit-tested.

export type PreviewMode = "html" | "url";

export type PreviewNavDecision =
  | { action: "allow" }
  | { action: "external_confirm"; url: string }
  | { action: "external_direct"; url: string }
  | { action: "block"; reason: "local_preview" | "invalid_url" | "unsupported_scheme" };

const SAFE_INTERNAL_SCHEMES = ["data:", "about:", "blob:"] as const;

export function getOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.protocol || !u.host) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function startsWithAny(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => value.startsWith(p));
}

export function isHttpLikeUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function decidePreviewNavigation(args: {
  mode: PreviewMode;
  baseOrigin: string | null;
  requestUrl: string;
}): PreviewNavDecision {
  const requestUrl = String(args.requestUrl || "").trim();

  if (!requestUrl) return { action: "block", reason: "invalid_url" };

  // Block navigation to local.preview (legacy placeholder that requires DNS)
  if (requestUrl.includes("local.preview")) {
    return { action: "block", reason: "local_preview" };
  }

  // Allow safe internal schemes
  if (requestUrl === "about:blank") return { action: "allow" };
  if (startsWithAny(requestUrl, SAFE_INTERNAL_SCHEMES)) return { action: "allow" };

  // Hand off custom schemes (mailto:, tel:, etc.) to OS directly.
  if (!isHttpLikeUrl(requestUrl)) {
    return { action: "external_direct", url: requestUrl };
  }

  // Keep preview "contained": open external links in the system browser.
  if (args.mode === "html") {
    return { action: "external_confirm", url: requestUrl };
  }

  if (args.mode === "url" && args.baseOrigin) {
    const origin = getOrigin(requestUrl);
    if (!origin) return { action: "block", reason: "invalid_url" };
    if (origin !== args.baseOrigin) {
      return { action: "external_confirm", url: requestUrl };
    }
  }

  return { action: "allow" };
}
