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

export const logger = {
  debug: safe(console.debug ? console.debug.bind(console) : console.log.bind(console)),
  info: safe(console.info ? console.info.bind(console) : console.log.bind(console)),
  log: safe(console.log.bind(console)),
  warn: safe(console.warn.bind(console)),
  error: safe(console.error.bind(console)),
};
