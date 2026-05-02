import { Buffer } from "buffer";
import * as sealedBoxModule from "tweetnacl-sealedbox-js";

type SodiumRuntime = {
  ready: Promise<void>;
  crypto_box_seal?: (message: Uint8Array, publicKey: Uint8Array) => Uint8Array;
};

type SodiumModule = SodiumRuntime & { default?: SodiumRuntime };

type SealedBoxRuntime = {
  seal?: (message: Uint8Array, publicKey: Uint8Array) => Uint8Array;
  default?: {
    seal?: (message: Uint8Array, publicKey: Uint8Array) => Uint8Array;
  };
};

let sodiumPromise: Promise<SodiumRuntime> | null = null;

const isReactNativeRuntime = (): boolean =>
  typeof navigator !== "undefined" && navigator.product === "ReactNative";

const loadSodium = async (): Promise<SodiumRuntime> => {
  if (!sodiumPromise) {
    sodiumPromise = (async () => {
      const modulePath: string = "libsodium-wrappers-sumo";
      try {
        const mod = (await import(modulePath)) as SodiumModule;
        return mod.default ?? mod;
      } catch {
        // Jest/node-cjs fallback without experimental VM modules.
        const mod = require(modulePath) as SodiumModule;
        return mod.default ?? mod;
      }
    })();
  }
  return sodiumPromise;
};

const resolveReactNativeSeal = (): ((message: Uint8Array, publicKey: Uint8Array) => Uint8Array) => {
  const mod = sealedBoxModule as unknown as SealedBoxRuntime;
  const seal = mod.seal ?? mod.default?.seal;
  if (typeof seal !== "function") {
    throw new Error("tweetnacl-sealedbox-js seal ist nicht verfuegbar.");
  }
  return seal;
};

export const ensureBuffer = () => {
  if (typeof Buffer === "undefined" || typeof Buffer.from !== "function") {
    throw new Error(
      '❌ Buffer polyfill fehlt oder ist unvollständig. Bitte "buffer" Package installieren: npm install buffer',
    );
  }
};

export const encodeGitHubFileContent = (content: string): string => {
  ensureBuffer();
  const trimmed = (content ?? "").toString();
  if (trimmed.startsWith("base64:")) {
    return trimmed.slice("base64:".length).trim();
  }
  return Buffer.from(trimmed, "utf8").toString("base64");
};

export const encryptSecret = async (publicKey: string, value: string): Promise<string> => {
  ensureBuffer();

  const messageBytes = Buffer.from(value, "utf8");
  const keyBytes = Buffer.from(publicKey, "base64");

  if (isReactNativeRuntime()) {
    const seal = resolveReactNativeSeal();
    const encryptedBytes = seal(messageBytes, keyBytes);
    return Buffer.from(encryptedBytes).toString("base64");
  }

  const sodium = await loadSodium();
  await sodium.ready;
  if (!sodium.crypto_box_seal) {
    throw new Error("libsodium crypto_box_seal ist nicht verfügbar.");
  }

  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString("base64");
};
