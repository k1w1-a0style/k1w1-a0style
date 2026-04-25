const KEYSTORE_ENVELOPE_PREFIX_V2 = "k1w1-ak:v2:";
const KEYSTORE_ENVELOPE_PREFIX_V3 = "k1w1-ak:v3:";
const PBKDF2_ITERATIONS = 210_000;
const LEGACY_COMPAT_MAX_PAYLOAD_CHARS = 24_000;

type KeystoreEnvelopeV2 = {
  v: 2;
  alg: "A256GCM";
  iv: string;
  ct: string;
};
type KeystoreEnvelopeV3 = {
  v: 3;
  alg: "A256GCM+PBKDF2";
  iv: string;
  ct: string;
  salt: string;
  iter: number;
};
type DecryptFormat = "v3" | "v2" | "legacy-cbc";

function bytesToBinaryString(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function binaryStringToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes));
}

function decodeBase64(input: string): Uint8Array {
  return binaryStringToBytes(atob(input));
}

function toBufferSource(bytes: Uint8Array): BufferSource {
  const sliced = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Uint8Array(sliced);
}

function looksLikeLegacyAesCbcPayload(payload: string): boolean {
  const normalized = payload.trim();
  if (normalized.length < 24 || normalized.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(normalized);
}

/**
 * Legacy compatibility KDF (SHA-256 only).
 * Strictly for legacy read/decrypt compatibility and migration fixtures.
 */
async function deriveLegacyCompatAesKeyBytesSha256(masterKey: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(masterKey);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hash);
}

async function deriveAesKeyBytesPbkdf2(masterKey: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    toBufferSource(new TextEncoder().encode(masterKey)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: toBufferSource(salt), iterations },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

function getRuntimeEnvVar(name: string): string | undefined {
  const maybeDeno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno;
  const denoGet = maybeDeno?.env?.get;
  if (typeof denoGet === "function") {
    return denoGet(name);
  }

  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return maybeProcess?.env?.[name];
}

export function isVersionedKeystoreEnvelope(value: string): boolean {
  return value.startsWith(KEYSTORE_ENVELOPE_PREFIX_V2) || value.startsWith(KEYSTORE_ENVELOPE_PREFIX_V3);
}

/**
 * @deprecated Legacy compatibility helper for tests/migration fixtures only.
 * Never use this for new writes.
 */
export async function __unsafeEncryptWithAesCbcLegacyForTests(payload: string, masterKey: string): Promise<string> {
  const runtimeEnv = getRuntimeEnvVar("DENO_ENV") ?? getRuntimeEnvVar("NODE_ENV") ?? "";
  if (runtimeEnv && runtimeEnv !== "test") {
    throw new Error("Legacy AES-CBC test helper may only run in test environment");
  }

  const keyBytes = await deriveLegacyCompatAesKeyBytesSha256(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    toBufferSource(keyBytes),
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );

  const data = new TextEncoder().encode(payload);
  const enc = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, data);
  const out = new Uint8Array(iv.length + enc.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(enc), iv.length);

  return encodeBase64(out);
}

/**
 * @deprecated Legacy compatibility helper for tests/migration fixtures only.
 * Never use this for new writes.
 */
export async function __unsafeEncryptWithAesGcmLegacyV2ForTests(payload: string, masterKey: string): Promise<string> {
  const runtimeEnv = getRuntimeEnvVar("DENO_ENV") ?? getRuntimeEnvVar("NODE_ENV") ?? "";
  if (runtimeEnv && runtimeEnv !== "test") {
    throw new Error("Legacy AES-GCM v2 test helper may only run in test environment");
  }

  const keyBytes = await deriveLegacyCompatAesKeyBytesSha256(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    toBufferSource(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const data = new TextEncoder().encode(payload);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const envelope: KeystoreEnvelopeV2 = {
    v: 2,
    alg: "A256GCM",
    iv: encodeBase64(iv),
    ct: encodeBase64(encrypted),
  };
  return `${KEYSTORE_ENVELOPE_PREFIX_V2}${btoa(JSON.stringify(envelope))}`;
}

async function decryptWithAesCbcLegacyCompatOnly(payload: string, masterKey: string): Promise<string> {
  if (payload.length > LEGACY_COMPAT_MAX_PAYLOAD_CHARS) {
    throw new Error("Legacy ciphertext exceeds compatibility size limit");
  }
  const bytes = decodeBase64(payload);
  if (bytes.length < 17) throw new Error("Encrypted blob too small");
  const iv = bytes.slice(0, 16);
  const enc = bytes.slice(16);

  const keyBytes = await deriveLegacyCompatAesKeyBytesSha256(masterKey);
  const key = await crypto.subtle.importKey(
    "raw",
    toBufferSource(keyBytes),
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );

  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, enc);
  return new TextDecoder().decode(new Uint8Array(dec));
}

export async function encryptKeystorePayload(payload: string, masterKey: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyBytes = await deriveAesKeyBytesPbkdf2(masterKey, salt, PBKDF2_ITERATIONS);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    toBufferSource(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const data = new TextEncoder().encode(payload);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));

  const envelope: KeystoreEnvelopeV3 = {
    v: 3,
    alg: "A256GCM+PBKDF2",
    iv: encodeBase64(iv),
    ct: encodeBase64(encrypted),
    salt: encodeBase64(salt),
    iter: PBKDF2_ITERATIONS,
  };

  const serialized = JSON.stringify(envelope);
  return `${KEYSTORE_ENVELOPE_PREFIX_V3}${btoa(serialized)}`;
}

function parseV2Envelope(payload: string): KeystoreEnvelopeV2 {
  const raw = payload.slice(KEYSTORE_ENVELOPE_PREFIX_V2.length);
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(raw));
  } catch {
    throw new Error("Encrypted keystore payload is malformed");
  }

  const obj = parsed as Partial<KeystoreEnvelopeV2>;
  if (obj?.v !== 2 || obj?.alg !== "A256GCM" || typeof obj.iv !== "string" || typeof obj.ct !== "string") {
    throw new Error("Encrypted keystore payload contract mismatch");
  }
  return obj as KeystoreEnvelopeV2;
}

function parseV3Envelope(payload: string): KeystoreEnvelopeV3 {
  const raw = payload.slice(KEYSTORE_ENVELOPE_PREFIX_V3.length);
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(raw));
  } catch {
    throw new Error("Encrypted keystore payload is malformed");
  }
  const obj = parsed as Partial<KeystoreEnvelopeV3>;
  if (
    obj?.v !== 3 ||
    obj?.alg !== "A256GCM+PBKDF2" ||
    typeof obj.iv !== "string" ||
    typeof obj.ct !== "string" ||
    typeof obj.salt !== "string" ||
    typeof obj.iter !== "number"
  ) {
    throw new Error("Encrypted keystore payload contract mismatch");
  }
  return obj as KeystoreEnvelopeV3;
}

async function decryptKeystorePayloadV2(payload: string, masterKey: string): Promise<string> {
  const envelope = parseV2Envelope(payload);

  try {
    const iv = decodeBase64(envelope.iv);
    const ciphertext = decodeBase64(envelope.ct);

    if (iv.length !== 12 || ciphertext.length < 17) {
      throw new Error("invalid sizes");
    }

    const keyBytes = await deriveLegacyCompatAesKeyBytesSha256(masterKey);
    const key = await crypto.subtle.importKey(
      "raw",
      toBufferSource(keyBytes),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toBufferSource(iv) },
      key,
      toBufferSource(ciphertext),
    );
    return new TextDecoder().decode(new Uint8Array(decrypted));
  } catch {
    throw new Error("Encrypted keystore payload failed integrity check");
  }
}

async function decryptKeystorePayloadWithFormat(
  payload: string,
  masterKey: string,
): Promise<{ plaintext: string; format: DecryptFormat }> {
  if (payload.startsWith(KEYSTORE_ENVELOPE_PREFIX_V3)) {
    const envelope = parseV3Envelope(payload);
    try {
      const iv = decodeBase64(envelope.iv);
      const ciphertext = decodeBase64(envelope.ct);
      const salt = decodeBase64(envelope.salt);
      if (iv.length !== 12 || ciphertext.length < 17 || salt.length < 8 || envelope.iter < 100_000) {
        throw new Error("invalid envelope sizes");
      }
      const keyBytes = await deriveAesKeyBytesPbkdf2(masterKey, salt, envelope.iter);
      const key = await crypto.subtle.importKey(
        "raw",
        toBufferSource(keyBytes),
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: toBufferSource(iv) },
        key,
        toBufferSource(ciphertext),
      );
      return { plaintext: new TextDecoder().decode(new Uint8Array(decrypted)), format: "v3" };
    } catch {
      throw new Error("Encrypted keystore payload failed integrity check");
    }
  }
  if (payload.startsWith(KEYSTORE_ENVELOPE_PREFIX_V2)) {
    return { plaintext: await decryptKeystorePayloadV2(payload, masterKey), format: "v2" };
  }

  // Legacy fallback for older AES-CBC records stored before v2 envelope rollout.
  // NOTE: read-only compatibility path; all new writes stay on v3 (PBKDF2 + AES-GCM).
  // Guardrail: only attempt AES-CBC fallback for payloads that actually look like legacy ciphertext.
  if (!looksLikeLegacyAesCbcPayload(payload)) {
    throw new Error("Encrypted keystore payload contract mismatch");
  }
  return { plaintext: await decryptWithAesCbcLegacyCompatOnly(payload, masterKey), format: "legacy-cbc" };
}

export async function decryptKeystorePayload(payload: string, masterKey: string): Promise<string> {
  const outcome = await decryptKeystorePayloadWithFormat(payload, masterKey);
  return outcome.plaintext;
}

export async function decryptKeystorePayloadWithMigration(
  payload: string,
  masterKey: string,
  persistMigratedV3Payload: (encryptedV3Payload: string) => Promise<void>,
): Promise<string> {
  const outcome = await decryptKeystorePayloadWithFormat(payload, masterKey);
  if (outcome.format === "v3") {
    return outcome.plaintext;
  }
  const migratedV3 = await encryptKeystorePayload(outcome.plaintext, masterKey);
  try {
    await persistMigratedV3Payload(migratedV3);
  } catch {
    throw new Error("Legacy keystore payload decrypted but v3 migration persistence failed");
  }
  return outcome.plaintext;
}
