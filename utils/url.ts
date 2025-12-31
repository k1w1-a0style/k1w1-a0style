// utils/url.ts
// Unified URL utility functions

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function truncateUrl(url: string, maxLength: number = 55): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + "...";
}

export function normalizePath(path: string): string {
  let p = path.trim();
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}
