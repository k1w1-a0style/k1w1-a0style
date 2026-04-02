/**
 * Minimal logger wrapper.
 * - In dev: forwards to console.
 * - In prod: debug/info/log are silenced (see polyfills.ts guard).
 */

type LogFn = (...args: unknown[]) => void;

const safe = (fn: LogFn): LogFn => {
  return (...args: unknown[]) => {
    try {
      fn(...args);
    } catch {
      // ignore
    }
  };
};

// IMPORTANT:
// Do NOT bind console methods here. Tests often spyOn(console, 'warn'/'info'/...)
// and binding would bypass the spy. Using dynamic console access keeps logging
// mockable and predictable.
export const logger = {
  debug: safe((...args: unknown[]) => (globalThis.console.debug ?? globalThis.console.log)(...args)),
  info: safe((...args: unknown[]) => (globalThis.console.info ?? globalThis.console.log)(...args)),
  log: safe((...args: unknown[]) => globalThis.console.log(...args)),
  warn: safe((...args: unknown[]) => globalThis.console.warn(...args)),
  error: safe((...args: unknown[]) => globalThis.console.error(...args)),
};
