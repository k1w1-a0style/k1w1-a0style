import { serve } from "https://deno.land/std@0.203.0/http/server.ts"; // Korrekter Deno Import

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Body sicher parsen
    let prompt, apiKey;
    try {
        const body = await req.json();
        prompt = body.prompt;
        apiKey = body.apiKey;
    } catch (e) {
        console.error("Fehler beim Parsen des Request Body:", e);
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }


    // Prompt und API Key validieren
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";

    // === MODELLNAME GEÄNDERT ===
    const model = 'llama-3.1-8b-instant'; // Oder 'llama-3.3-70b-versatile' etc.
    console.log(`Anfrage an Groq mit Modell: ${model}`);
    // ===========================

    const groqResponse = await fetch(groqApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model, // Korrigiertes Modell verwenden
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    // Detaillierteres Error Handling für Groq
    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      console.error(`Groq API Error: Status ${groqResponse.status}, Body: ${errorBody}`);
      // Versuche, JSON aus dem Error-Body zu parsen
      let detail = errorBody;
      try {
          const errorJson = JSON.parse(errorBody);
          detail = errorJson.error?.message || errorBody;
      } catch(e){}

      // Gebe detailliertere Fehlermeldung zurück
      return new Response(JSON.stringify({ error: `Groq API Error: ${groqResponse.status}`, detail: detail }), {
        status: groqResponse.status, // Verwende den Status von Groq
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqData = await groqResponse.json();

    return new Response(JSON.stringify({ data: groqData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unerwarteter Fehler in Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
