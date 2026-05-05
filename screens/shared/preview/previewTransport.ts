export type PreviewWebViewSource =
  | { type: 'url'; uri: string; headers?: Record<string, string> }
  | { type: 'html'; html: string; baseUrl?: string };

const PREVIEW_SECRET_HEADER = 'x-k1w1-preview-secret';

export function resolveWebViewPreviewSource(source: { type: 'url'; uri: string } | { type: 'html'; html: string; baseUrl?: string } | null): PreviewWebViewSource | null {
  if (!source) return null;
  if (source.type === 'html') return source;

  try {
    const parsed = new URL(source.uri);
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const secret = (hashParams.get('secret') || '').trim();
    const transport = (parsed.searchParams.get('transport') || '').trim().toLowerCase();

    if (transport === 'fragment' && secret) {
      parsed.hash = '';
      return {
        type: 'url',
        uri: parsed.toString(),
        headers: { [PREVIEW_SECRET_HEADER]: secret },
      };
    }
  } catch {
    return source;
  }

  return source;
}
