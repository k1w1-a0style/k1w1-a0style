declare function require(name: string): unknown;

declare module "buffer" {
  export const Buffer: {
    from(value: unknown, encoding?: string): {
      toString(encoding?: string): string;
    };
  };
}

declare module "expo-crypto" {
  export function getRandomBytesAsync(length: number): Promise<Uint8Array>;
}
