export type ExpoGraphQLResponse = {
  data?: {
    me?: { username?: string };
    viewer?: { username?: string };
    user?: { username?: string };
  };
  errors?: Array<{ message?: string }>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseExpoGraphQLUsername(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Expo GraphQL Antwort war kein valides JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("Expo GraphQL Antwort hat ein ungueltiges Format");
  }

  const payload = parsed as ExpoGraphQLResponse;

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const msg = payload.errors[0]?.message;
    throw new Error(msg ? String(msg) : "Expo GraphQL error");
  }

  const data = payload.data;
  if (!data || !isRecord(data)) {
    throw new Error("Expo GraphQL Antwort enthaelt keine Nutzerdaten");
  }

  const username =
    data.me?.username ||
    data.viewer?.username ||
    data.user?.username ||
    "";

  return String(username || "");
}
