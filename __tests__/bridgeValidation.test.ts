// __tests__/bridgeValidation.test.ts
// Tests for the strict WebView ↔ RN bridge message validation in WebCodeEditor.
import {
  isInboundMsg,
  MAX_BRIDGE_PAYLOAD,
  parseBridgeMessage,
} from "../screens/CodeScreen/components/WebCodeEditor";

describe("isInboundMsg – type guard", () => {
  it("accepts a valid 'ready' message", () => {
    expect(isInboundMsg({ t: "ready" })).toBe(true);
  });

  it("accepts a valid 'value' message with string value", () => {
    expect(isInboundMsg({ t: "value", value: "hello world" })).toBe(true);
  });

  it("accepts a valid 'focus' message", () => {
    expect(isInboundMsg({ t: "focus", focused: true })).toBe(true);
    expect(isInboundMsg({ t: "focus", focused: false })).toBe(true);
  });

  it("rejects null / undefined / primitives", () => {
    expect(isInboundMsg(null)).toBe(false);
    expect(isInboundMsg(undefined)).toBe(false);
    expect(isInboundMsg(42)).toBe(false);
    expect(isInboundMsg("string")).toBe(false);
    expect(isInboundMsg(true)).toBe(false);
  });

  it("rejects objects without a known 't' field", () => {
    expect(isInboundMsg({})).toBe(false);
    expect(isInboundMsg({ t: "unknown" })).toBe(false);
    expect(isInboundMsg({ type: "ready" })).toBe(false);
  });

  it("rejects 'value' messages with non-string value", () => {
    expect(isInboundMsg({ t: "value", value: 123 })).toBe(false);
    expect(isInboundMsg({ t: "value", value: null })).toBe(false);
    expect(isInboundMsg({ t: "value", value: undefined })).toBe(false);
    expect(isInboundMsg({ t: "value" })).toBe(false);
  });

  it("rejects 'focus' messages with non-boolean focused", () => {
    expect(isInboundMsg({ t: "focus", focused: "true" })).toBe(false);
    expect(isInboundMsg({ t: "focus", focused: 1 })).toBe(false);
    expect(isInboundMsg({ t: "focus" })).toBe(false);
  });

  it("rejects 'value' messages exceeding MAX_BRIDGE_PAYLOAD", () => {
    const hugeValue = "x".repeat(MAX_BRIDGE_PAYLOAD + 1);
    expect(isInboundMsg({ t: "value", value: hugeValue })).toBe(false);
  });

  it("accepts 'value' messages exactly at MAX_BRIDGE_PAYLOAD", () => {
    const maxValue = "x".repeat(MAX_BRIDGE_PAYLOAD);
    expect(isInboundMsg({ t: "value", value: maxValue })).toBe(true);
  });
});

describe("parseBridgeMessage – end-to-end parsing", () => {
  it("parses and sanitizes a valid ready message", () => {
    const result = parseBridgeMessage(JSON.stringify({ t: "ready", extra: 1 }));
    expect(result).toEqual({ t: "ready" });
  });

  it("parses and sanitizes a valid value message", () => {
    const result = parseBridgeMessage(
      JSON.stringify({ t: "value", value: "const x = 1;", extra: "ignored" }),
    );
    expect(result).toEqual({ t: "value", value: "const x = 1;" });
  });

  it("parses and sanitizes a valid focus message", () => {
    const result = parseBridgeMessage(
      JSON.stringify({ t: "focus", focused: true, extra: 1 }),
    );
    expect(result).toEqual({ t: "focus", focused: true });
  });

  it("returns null for invalid JSON", () => {
    expect(parseBridgeMessage("not json")).toBeNull();
    expect(parseBridgeMessage("{broken")).toBeNull();
  });

  it("returns null for empty / falsy input", () => {
    expect(parseBridgeMessage("")).toBeNull();
    expect(parseBridgeMessage(null as any)).toBeNull();
    expect(parseBridgeMessage(undefined as any)).toBeNull();
  });

  it("returns null for valid JSON that isn't a known message", () => {
    expect(parseBridgeMessage(JSON.stringify({ foo: "bar" }))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify([1, 2, 3]))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify("just a string"))).toBeNull();
  });

  it("returns null for oversized raw payloads", () => {
    const huge = "x".repeat(MAX_BRIDGE_PAYLOAD + 100);
    expect(parseBridgeMessage(huge)).toBeNull();
  });

  it("rejects prototype pollution attempts by sanitizing", () => {
    const payload = JSON.stringify({
      t: "value",
      value: "ok",
      __proto__: { admin: true },
    });

    const result = parseBridgeMessage(payload);
    expect(result).toEqual({ t: "value", value: "ok" });
    expect((Object.prototype as any).admin).toBeUndefined();
  });
});

describe("MAX_BRIDGE_PAYLOAD constant", () => {
  it("is a reasonable size (between 1MB and 10MB)", () => {
    expect(MAX_BRIDGE_PAYLOAD).toBeGreaterThanOrEqual(1_000_000);
    expect(MAX_BRIDGE_PAYLOAD).toBeLessThanOrEqual(10_000_000);
  });
});
