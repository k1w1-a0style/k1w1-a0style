// polyfills.ts
import { Buffer } from "buffer";

// React-Native/Hermes hat keinen globalen Node-Buffer
type PolyfillGlobal = typeof globalThis & { Buffer?: typeof Buffer; __DEV__?: boolean };
const runtimeGlobal = globalThis as PolyfillGlobal;
runtimeGlobal.Buffer = Buffer;

// In production builds, avoid leaking secrets/noise via console output.
// Keep warn/error intact for diagnostics.
const __DEV_FLAG__ = runtimeGlobal.__DEV__;
const isDev =
  typeof __DEV_FLAG__ === "boolean"
    ? __DEV_FLAG__
    : process.env.NODE_ENV !== "production";

if (!isDev) {
  const noop: typeof console.log = () => {};
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;
}
