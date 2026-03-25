declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }

  function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: any;
}

declare module "https://esm.sh/node-forge@1.3.1?pin=v135&target=deno" {
  const forge: any;
  export default forge;
}

declare module "https://esm.sh/fflate@0.8.2?deno" {
  export const unzipSync: any;
  export const strFromU8: any;
}

declare module "npm:fflate@0.8.2" {
  export const unzipSync: any;
  export const strFromU8: any;
}
