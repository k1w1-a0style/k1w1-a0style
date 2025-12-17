/**
 * Type declarations for Expo modules that lack proper TypeScript definitions
 */

// expo-crypto types
declare module 'expo-crypto' {
  export const CryptoDigestAlgorithm: {
    SHA256: string;
    SHA384: string;
    SHA512: string;
    MD5: string;
  };

  export function digestStringAsync(
    algorithm: string,
    data: string
  ): Promise<string>;

  export function getRandomBytesAsync(byteCount: number): Promise<Uint8Array>;
}

// expo-constants types
declare module 'expo-constants' {
  interface ExpoConstants {
    deviceId?: string;
    appOwnership?: string;
    debugMode?: boolean;
    deviceName?: string;
    deviceYearClass?: number;
    experienceUrl?: string;
    expoVersion?: string;
    installationId?: string;
    isDetached?: boolean;
    isDevice?: boolean;
    isHeadless?: boolean;
    linkingUri?: string;
    manifest?: object;
    manifest2?: object;
    nativeAppVersion?: string;
    nativeBuildVersion?: string;
    platform?: {
      ios?: {
        buildNumber?: string;
        platform?: string;
        model?: string;
        userInterfaceIdiom?: string;
      };
      android?: {
        versionCode?: number;
      };
    };
    sessionId?: string;
    statusBarHeight?: number;
    systemFonts?: string[];
  }

  const Constants: ExpoConstants;
  export default Constants;
}
