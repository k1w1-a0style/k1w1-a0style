import { sanitizeTitle } from "./sandpackHelpers";

const BLOCKED_FALLBACK_CARD_CSS = `
  html, body { margin: 0; padding: 0; min-height: 100%; background: #0a0a0a; color: #eee; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .card { max-width: 560px; border-radius: 14px; border: 1px solid #5b2020; background: #1a0808; padding: 16px; }
  h1 { margin: 0 0 10px; color: #ff6b6b; font-size: 16px; }
  p { margin: 0; color: #ffb3b3; font-size: 13px; line-height: 1.5; }
`;

function buildBlockedFallbackCardHtml(params: {
  title: string;
  heading: string;
  description: string;
}): string {
  const safeTitle = sanitizeTitle(params.title);
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
<meta name="color-scheme" content="dark" />
<title>${safeTitle}</title>
<style>${BLOCKED_FALLBACK_CARD_CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>${params.heading}</h1>
      <p>${params.description}</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildDisabledProductionFallbackHtml(title: string, fileCount: number): string {
  return buildBlockedFallbackCardHtml({
    title,
    heading: "Lokaler HTML-/Eval-Fallback deaktiviert",
    description: `Lokaler Eval-/Babel-/CDN-Pfad ist standardmaessig gesperrt (${fileCount} Dateien). Bitte Remote-Preview ueber Supabase verwenden oder den Fallback nur explizit pro Aufruf erlauben.`,
  });
}

export function buildUnsafeEvalMissingCdnOptInHtml(title: string, fileCount: number): string {
  return buildBlockedFallbackCardHtml({
    title,
    heading: "Lokaler Eval-Pfad blockiert",
    description: `Expliziter Dev-Eval wurde angefordert (${fileCount} Dateien), aber externe CDN-Lader sind nicht freigegeben. Der Local-Eval-Pfad bleibt fail-closed bis beide Opt-ins aktiv sind.`,
  });
}

export const SANDPACK_HTML_CSP_DIRECTIVES = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://esm.sh",
  "style-src 'unsafe-inline'",
  "img-src data: blob: https:",
  "font-src data: https:",
  "connect-src 'none'",
] as const;
