// polyfills.ts
import { Buffer } from "buffer";

// React-Native/Hermes hat keinen globalen Node-Buffer
(globalThis as any).Buffer = Buffer;

// In production builds, avoid leaking secrets/noise via console output.
// Keep warn/error intact for diagnostics.
const __DEV_FLAG__ = (globalThis as any).__DEV__;
const isDev =
  typeof __DEV_FLAG__ === "boolean"
    ? __DEV_FLAG__
    : process.env.NODE_ENV !== "production";

if (!isDev) {
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop as any;
  // eslint-disable-next-line no-console
  console.info = noop as any;
  // eslint-disable-next-line no-console
  console.debug = noop as any;
}
