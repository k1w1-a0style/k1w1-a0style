declare function require(name: string): unknown;

declare module "buffer" {
  type BufferEncoding =
    | "ascii"
    | "utf8"
    | "utf-8"
    | "utf16le"
    | "ucs2"
    | "ucs-2"
    | "base64"
    | "base64url"
    | "latin1"
    | "binary"
    | "hex";
  interface BufferLike extends Uint8Array {
    toString(encoding?: BufferEncoding): string;
  }

  export const Buffer: {
    from(value: string, encoding?: BufferEncoding): BufferLike;
    from(value: ArrayBufferLike | ArrayLike<number>): BufferLike;
    concat(list: readonly Uint8Array[]): BufferLike;
  };
}

declare module "expo-crypto" {
  export function getRandomBytesAsync(length: number): Promise<Uint8Array>;
}
