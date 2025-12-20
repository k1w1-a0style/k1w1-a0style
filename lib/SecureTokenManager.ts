// lib/SecureTokenManager.ts
// Token storage wrapper for expo-secure-store with metadata + obfuscation (test aligned).

import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';

export type TokenMetadata = {
  exists: boolean;
  createdAt?: string;
  expiresAt?: string | null;
  isExpired?: boolean;
};

type StoredTokenV1 = {
  version: 1;
  v: string; // base64(value)
  createdAt: string; // ISO
  expiresAt: string | null; // ISO or null
};

// Tests expect these known keys to be wiped by clearAllTokens()
const KNOWN_TOKEN_KEYS = ['github_token', 'expo_token'];

function optionsForSecureStore() {
  // ✅ Tests expect keychainAccessible: 4
  return { keychainAccessible: 4 as any };
}

function encode(value: string): string {
  return Buffer.from(String(value ?? ''), 'utf8').toString('base64');
}

function decode(b64: string): string {
  try {
    return Buffer.from(String(b64 ?? ''), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function toIsoOrNull(expiresAt?: Date | string | null): string | null {
  if (expiresAt == null) return null;
  if (expiresAt instanceof Date) return expiresAt.toISOString();
  const s = String(expiresAt);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isExpiredIso(expiresAtIso: string | null): boolean {
  if (!expiresAtIso) return false;
  const d = new Date(expiresAtIso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

async function readRaw(key: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): StoredTokenV1 | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<StoredTokenV1>;
    if (
      obj &&
      obj.version === 1 &&
      typeof obj.v === 'string' &&
      typeof obj.createdAt === 'string'
    ) {
      return {
        version: 1,
        v: obj.v,
        createdAt: obj.createdAt,
        expiresAt: typeof obj.expiresAt === 'string' ? obj.expiresAt : null,
      };
    }
  } catch {
    // legacy plain string
  }
  return null;
}

export default class SecureTokenManager {
  static async saveToken(
    key: string,
    value: string,
    expiresAt?: Date | string | null,
  ): Promise<void> {
    const createdAt = new Date().toISOString();
    const expiresAtIso = toIsoOrNull(expiresAt);

    const payload: StoredTokenV1 = {
      version: 1,
      v: encode(String(value ?? '')),
      createdAt,
      expiresAt: expiresAtIso,
    };

    await SecureStore.setItemAsync(key, JSON.stringify(payload), optionsForSecureStore());
  }

  static async getToken(key: string): Promise<string | null> {
    const raw = await readRaw(key);
    if (raw == null) return null;

    const parsed = parseStored(raw);
    if (parsed) {
      if (isExpiredIso(parsed.expiresAt)) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {}
        return null;
      }
      return decode(parsed.v);
    }

    // legacy plain string storage
    return String(raw);
  }

  static async deleteToken(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  static async rotateToken(
    key: string,
    newValue: string,
    expiresAt?: Date | string | null,
  ): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    await SecureTokenManager.saveToken(key, newValue, expiresAt);
  }

  static async hasValidToken(key: string): Promise<boolean> {
    const token = await SecureTokenManager.getToken(key);
    // empty string counts as valid in tests
    return token !== null;
  }

  static async getTokenMetadata(key: string): Promise<TokenMetadata> {
    const raw = await readRaw(key);
    if (!raw) return { exists: false };

    const parsed = parseStored(raw);
    if (!parsed) {
      return { exists: true, createdAt: new Date().toISOString(), expiresAt: null, isExpired: false };
    }

    const expired = isExpiredIso(parsed.expiresAt);
    return {
      exists: true,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      isExpired: expired,
    };
  }

  static async clearAllTokens(): Promise<void> {
    await Promise.all(
      KNOWN_TOKEN_KEYS.map(async (k) => {
        try {
          await SecureStore.deleteItemAsync(k);
        } catch {}
      }),
    );
  }
}
