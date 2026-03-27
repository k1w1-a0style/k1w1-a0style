/**
 * Minimal logger wrapper.
 * - In dev: forwards to console.
 * - In prod: debug/info/log are silenced (see polyfills.ts guard).
 */

type LogFn = (...args: any[]) => void;

const safe = (fn: LogFn): LogFn => {
  return (...args: any[]) => {
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
  debug: safe((...args: any[]) => (globalThis.console.debug ?? globalThis.console.log)(...args)),
  info: safe((...args: any[]) => (globalThis.console.info ?? globalThis.console.log)(...args)),
  log: safe((...args: any[]) => globalThis.console.log(...args)),
  warn: safe((...args: any[]) => globalThis.console.warn(...args)),
  error: safe((...args: any[]) => globalThis.console.error(...args)),
};
