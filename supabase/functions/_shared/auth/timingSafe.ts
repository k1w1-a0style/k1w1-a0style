const encoder = new TextEncoder();

/**
 * Constant-time-ish comparison for secrets.
 * Fails closed for empty inputs and mismatched lengths.
 */
export function timingSafeSecretEqual(
  got: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (typeof got !== "string" || typeof expected !== "string") return false;
  if (!got || !expected) return false;

  const gotBytes = encoder.encode(got);
  const expectedBytes = encoder.encode(expected);
  const maxLen = Math.max(gotBytes.length, expectedBytes.length);
  if (maxLen === 0) return false;

  let diff = gotBytes.length ^ expectedBytes.length;
  for (let i = 0; i < maxLen; i += 1) {
    const a = i < gotBytes.length ? gotBytes[i] : 0;
    const b = i < expectedBytes.length ? expectedBytes[i] : 0;
    diff |= a ^ b;
  }
  return diff === 0;
}
