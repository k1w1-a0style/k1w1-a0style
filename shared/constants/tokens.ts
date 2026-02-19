export const TOKEN_KEYS = {
  github: "github_token",
  expo: "expo_token",
} as const;

export type TokenKey = (typeof TOKEN_KEYS)[keyof typeof TOKEN_KEYS];

export const KNOWN_TOKEN_KEYS: readonly TokenKey[] = [TOKEN_KEYS.github, TOKEN_KEYS.expo] as const;
