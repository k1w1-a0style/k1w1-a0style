/**
 * Masking helpers for displaying API keys safely in the UI.
 *
 * Goal: keep keys identifiable for the user without exposing secrets during
 * screenshots, screen recordings or shoulder-surfing.
 */
export function maskApiKey(key: string): string {
  const trimmed = (key ?? '').trim();
  if (!trimmed) return '••••••••';

  // Too short to safely show prefix/suffix
  if (trimmed.length <= 16) return '••••••••';

  const prefix = trimmed.slice(0, 8);
  const suffix = trimmed.slice(-4);

  // Keep mask length bounded so it doesn't overflow small screens.
  const dynamic = Math.max(6, trimmed.length - 12);
  const maskLen = Math.min(dynamic, 18);

  return `${prefix}${'•'.repeat(maskLen)}${suffix}`;
}

export function looksLikeApiKey(value: string): boolean {
  const v = (value ?? '').trim();
  if (!v) return false;
  // crude but helpful: avoid whitespace and require some length
  return v.length >= 20 && !/\s/.test(v);
}
