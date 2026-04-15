export function isLikelyWellFormedAdminKeyForUiPrecheck(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  if (/\s/.test(k)) return false;
  // Service role keys / JWTs are typically fairly long.
  if (k.length < 20) return false;
  return true;
}
