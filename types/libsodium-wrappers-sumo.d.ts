declare module "libsodium-wrappers-sumo" {
  export type SodiumModule = {
    ready: Promise<unknown>;
    crypto_box_seal?: (message: Uint8Array, key: Uint8Array) => Uint8Array;
  };

  const sodium: SodiumModule;
  export default sodium;
}
