// Small helper used by UI to reduce accidental secret leaks (screenshots/shoulder surfing).

export function maskApiKey(key: string): string {
  const k = (key ?? "").trim();
  if (!k || k.length < 12) return "••••••••";

  // show first 4 + last 4, mask the rest (cap dot count to avoid huge strings)
  const prefix = k.substring(0, 4);
  const suffix = k.substring(k.length - 4);
  const maskedLength = Math.max(0, k.length - 8);
  const dots = "•".repeat(Math.min(maskedLength, 32));

  return `${prefix}${dots}${suffix}`;
}
