const isDevBridgeDiagnostics = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";
let hasLoggedBridgeParseFailure = false;

function logBridgeParseFailure(reason: string): void {
  if (!isDevBridgeDiagnostics || hasLoggedBridgeParseFailure) return;
  hasLoggedBridgeParseFailure = true;
  console.warn("[WebCodeEditor] dropping malformed bridge message", { reason });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export type InboundMsg =
  | { t: "ready" }
  | { t: "value"; value: string }
  | { t: "focus"; focused: boolean };

export const MAX_BRIDGE_PAYLOAD = 5_000_000; // ~5MB

export function isInboundMsg(v: unknown): v is InboundMsg {
  if (!isPlainObject(v)) return false;
  const obj = v as Record<string, unknown>;

  switch (obj.t) {
    case "ready":
      return true;
    case "value":
      return typeof obj.value === "string" && obj.value.length <= MAX_BRIDGE_PAYLOAD;
    case "focus":
      return typeof obj.focused === "boolean";
    default:
      return false;
  }
}

function sanitizeInboundMsg(v: InboundMsg): InboundMsg {
  switch (v.t) {
    case "ready":
      return { t: "ready" };
    case "value":
      return { t: "value", value: v.value };
    case "focus":
      return { t: "focus", focused: v.focused };
  }
}

export function parseBridgeMessage(raw: unknown): InboundMsg | null {
  if (typeof raw !== "string" || !raw) return null;
  if (raw.length > MAX_BRIDGE_PAYLOAD) {
    logBridgeParseFailure("payload_too_large");
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isInboundMsg(parsed)) {
      logBridgeParseFailure("schema_mismatch");
      return null;
    }
    return sanitizeInboundMsg(parsed);
  } catch {
    logBridgeParseFailure("invalid_json");
    return null;
  }
}

export function buildInjectedMessageEventScript(data: string): string {
  const serializedData = JSON.stringify(data);
  return `window.dispatchEvent(new MessageEvent('message',{data:${serializedData}}));document.dispatchEvent(new MessageEvent('message',{data:${serializedData}}));true;`;
}
