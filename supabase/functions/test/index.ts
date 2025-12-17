import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log("✅ Test Function called successfully");

    return new Response(
      JSON.stringify({
        message: "Supabase Edge Functions funktionieren!",
        timestamp: new Date().toISOString(),
        status: "ok",
        environment: {
          deno: Deno.version.deno,
          v8: Deno.version.v8,
          typescript: Deno.version.typescript,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("❌ Test Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal error",
        status: "error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
