const KEYSTORE_ENVELOPE_PREFIX_V2 = "k1w1-ak:v2:";
const KEYSTORE_ENVELOPE_PREFIX_V3 = "k1w1-ak:v3:";
const PBKDF2_ITERATIONS = 210_000;

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

async function deriveAesKeyBytes(masterKey: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(masterKey);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hash);
}

async function deriveAesKeyBytesPbkdf2(masterKey: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey) as unknown as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

export function isVersionedKeystoreEnvelope(value: string): boolean {
  return value.startsWith(KEYSTORE_ENVELOPE_PREFIX_V2) || value.startsWith(KEYSTORE_ENVELOPE_PREFIX_V3);
}

/**
 * @deprecated Legacy compatibility helper for tests/migration fixtures only.
 * Never use this for new writes.
 */
export async function __unsafeEncryptWithAesCbcLegacyForTests(payload: string, masterKey: string): Promise<string> {
  const keyBytes = await deriveAesKeyBytes(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
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

async function decryptWithAesCbcLegacy(payload: string, masterKey: string): Promise<string> {
  const bytes = decodeBase64(payload);
  if (bytes.length < 17) throw new Error("Encrypted blob too small");
  const iv = bytes.slice(0, 16);
  const enc = bytes.slice(16);

  const keyBytes = await deriveAesKeyBytes(masterKey);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
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
    keyBytes as unknown as BufferSource,
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

    const keyBytes = await deriveAesKeyBytes(masterKey);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource,
    );
    return new TextDecoder().decode(new Uint8Array(decrypted));
  } catch {
    throw new Error("Encrypted keystore payload failed integrity check");
  }
}

export async function decryptKeystorePayload(payload: string, masterKey: string): Promise<string> {
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
        keyBytes as unknown as BufferSource,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as unknown as BufferSource },
        key,
        ciphertext as unknown as BufferSource,
      );
      return new TextDecoder().decode(new Uint8Array(decrypted));
    } catch {
      throw new Error("Encrypted keystore payload failed integrity check");
    }
  }
  if (payload.startsWith(KEYSTORE_ENVELOPE_PREFIX_V2)) {
    return decryptKeystorePayloadV2(payload, masterKey);
  }

  // Legacy fallback for older AES-CBC records stored before v2 envelope rollout.
  return decryptWithAesCbcLegacy(payload, masterKey);
}
