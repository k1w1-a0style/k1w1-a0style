// Local augmentation for expo-file-system.
// In this repo, ESLint(import/namespace) validates exported members strictly.
// Some expo-file-system versions ship these exports at runtime, but the .d.ts in this project
// doesn't expose them, which previously forced unsafe `any` casts.

declare module "expo-file-system" {
  /** Writable directory for persistent documents (trailing slash). */
  export const documentDirectory: string | null;

  /** Writable directory for cache data (trailing slash). */
  export const cacheDirectory: string | null;

  export enum EncodingType {
    UTF8 = "utf8",
    Base64 = "base64",
  }

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: {
      encoding?: EncodingType;
    },
  ): Promise<void>;
}
