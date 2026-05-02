import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Edge helper visibility invariants", () => {
  const cases = [
    {
      name: "k1w1-handler",
      index: "supabase/functions/k1w1-handler/index.ts",
      helpers: "supabase/functions/k1w1-handler/helpers.ts",
      imports: [
        "corsHeadersForRequest",
        "getRequestRateLimitSubject",
        "handleCors",
        "parseJsonBody",
        "rateLimit",
        "requireAiOperatorJwtRoleWithVerifiedActor",
        "requireDurableRateLimit",
      ],
      reexports: [
        'export { corsHeadersForRequest, handleCors } from "../_shared/cors.ts";',
        '../_shared/auth.ts',
        'getRequestRateLimitSubject',
        'requireAiOperatorJwtRoleWithVerifiedActor',
        'requireDurableRateLimit',
        'rateLimit',
        'export { parseJsonBody } from "../_shared/validation.ts";',
      ],
    },
    {
      name: "android-keystore-export",
      index: "supabase/functions/android-keystore-export/index.ts",
      helpers: "supabase/functions/android-keystore-export/helpers.ts",
      imports: [
        "createClient",
        "errorResponse",
        "getServiceRoleKey",
        "getSigningMasterKey",
        "getSupabaseUrl",
        "handleCors",
        "jsonResponse",
        "rateLimit",
        "requireServiceRoleJwtWithVerifiedActor",
        "requireOwnerOrJwtAuth",
      ],
      reexports: [
        'export { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
        'export { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";',
        'rateLimit',
        'requireAdminKey',
        'hasAdminKeySecretConfigured',
        'getServiceRoleKey',
        'getSigningMasterKey',
        'getSupabaseUrl',
        'requireServiceRoleJwtWithVerifiedActor',
      ],
    },
    {
      name: "android-keystore-generate",
      index: "supabase/functions/android-keystore-generate/index.ts",
      helpers: "supabase/functions/android-keystore-generate/helpers.ts",
      imports: [
        "bytesToBinaryString",
        "createClient",
        "encryptKeystorePayload",
        "errorResponse",
        "getServiceRoleKey",
        "getSigningMasterKey",
        "getSupabaseUrl",
        "handleCors",
        "jsonResponse",
        "rateLimit",
        "requireOwnerOrJwtAuth",
        "requirePrivilegedOperatorJwtRoleWithVerifiedActor",
      ],
      reexports: [
        'export { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
        'export { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";',
        'requireOwnerOrJwtAuth',
        'requirePrivilegedOperatorJwtRoleWithVerifiedActor',
      ],
    },
  ];

  for (const c of cases) {
    it(`${c.name} keeps helper reexports visible to index.ts`, () => {
      const indexSrc = read(c.index);
      const helperSrc = read(c.helpers);

      for (const imported of c.imports) {
        expect(indexSrc).toContain(imported);
      }

      for (const line of c.reexports) {
        expect(helperSrc).toContain(line);
      }
    });
  }
});

describe("Edge direct-import invariants", () => {
  const directCases = [
    {
      name: "github-run-artifact-json",
      index: "supabase/functions/github-run-artifact-json/index.ts",
      imports: [
        "handleCors",
        "jsonResponse",
        "errorResponse",
        "githubFetchJson",
        "githubFetchRaw",
        "getGithubToken",
      ],
    },
    {
      name: "trigger-eas-build",
      index: "supabase/functions/trigger-eas-build/routeCore.ts",
      imports: ["handleCors", "requireOwnerOrJwtAuth", "rateLimit", "getGithubToken"],
    },
  ];

  for (const c of directCases) {
    it(`${c.name} imports required helpers directly`, () => {
      const indexSrc = read(c.index);
      for (const imported of c.imports) {
        expect(indexSrc).toContain(imported);
      }
    });
  }
});
