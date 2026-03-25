declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }

  function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export { createClient } from "@supabase/supabase-js";
}

declare module "https://esm.sh/node-forge@1.3.1?pin=v135&target=deno" {
  type ForgeRandom = {
    getBytesSync: (count: number) => string;
    getBytes: (count: number, cb?: (err: unknown, bytes: string) => void) => string | void;
  };

  const forge: {
    random: ForgeRandom;
  };
  export default forge;
}

declare module "https://esm.sh/fflate@0.8.2?deno" {
  export function unzipSync(data: Uint8Array): Record<string, Uint8Array>;
  export function strFromU8(data: Uint8Array): string;
}

declare module "npm:fflate@0.8.2" {
  export function unzipSync(data: Uint8Array): Record<string, Uint8Array>;
  export function strFromU8(data: Uint8Array): string;
}
