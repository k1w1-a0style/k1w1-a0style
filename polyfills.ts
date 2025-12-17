// polyfills.ts
import { Buffer } from 'buffer';

// React-Native/Hermes hat keinen globalen Node-Buffer
(globalThis as any).Buffer = Buffer;
