import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Hilfsfunktion für Groq ---
async function handleGroqRequest(prompt: string, model: string, apiKey: string) {
  console.log(`Starte Groq-Anfrage mit Modell: ${model}`);
  
  let effectiveModel = model;
  if (model === 'auto-groq') {
    // Einfache Auto-Logik (kann verfeinert werden)
    if (prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('ui')) {
      effectiveModel = 'llama-3.3-70b-versatile'; // Gut für UI/Code
    } else if (prompt.length > 500) { // Längere Texte
      effectiveModel = 'openai/gpt-oss-120b'; // Gut für Logik
    } else {
      effectiveModel = 'llama-3.1-8b-instant'; // Schnell für kurze Anfragen
    }
    console.log(`Auto-Groq hat gewählt: ${effectiveModel}`);
  }
  
  const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";
  
  const groqResponse = await fetch(groqApiUrl, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: effectiveModel, // Verwende das ausgewählte oder Auto-Modell
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!groqResponse.ok) {
    const errorBody = await groqResponse.text();
    console.error(`Groq API Fehler: Status ${groqResponse.status}, Body: ${errorBody}`);
    let detail = errorBody;
    try { detail = JSON.parse(errorBody).error?.message || errorBody; } catch(e){}
    throw new Error(`Groq API Error (${groqResponse.status}): ${detail}`);
  }
  
  return await groqResponse.json();
}

// --- Platzhalter für OpenAI ---
async function handleOpenAIRequest(prompt: string, model: string, apiKey: string) {
  console.log(`Starte OpenAI-Anfrage mit Modell: ${model}`);
  // TODO: Implementiere fetch-Aufruf an api.openai.com
  // const openaiApiUrl = "https://api.openai.com/v1/chat/completions";
  // const response = await fetch(openaiApiUrl, { ... });
  
  // Vorerst nur ein Dummy-Response
  return {
    choices: [{
      message: {
        role: "assistant",
        content: `(OpenAI-Platzhalter: Hätte jetzt mit ${model} geantwortet.)`
      }
    }]
  };
}
// TODO: handleGeminiRequest, handleAnthropicRequest...


// --- Haupt-Handler ---
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let prompt, apiKey, provider, model;
    try {
        const body = await req.json();
        prompt = body.prompt;
        apiKey = body.apiKey;
        provider = body.provider; // NEU
        model = body.model; // NEU
    } catch (e) {
        console.error("Fehler beim Parsen des Request Body:", e.message);
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!prompt || !apiKey || !provider || !model) {
      const missing = [!prompt && "prompt", !apiKey && "apiKey", !provider && "provider", !model && "model"].filter(Boolean).join(', ');
      console.warn(`Aufruf fehlgeschlagen. Es fehlt: ${missing}`);
      return new Response(JSON.stringify({ error: `Die Parameter ${missing} sind erforderlich.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let responseData;

    // --- API-Router ---
    console.log(`Routing an Provider: ${provider}`);
    switch(provider) {
      case 'groq':
        responseData = await handleGroqRequest(prompt, model, apiKey);
        break;
      case 'openai':
        responseData = await handleOpenAIRequest(prompt, model, apiKey);
        break;
      // TODO: Andere Provider hinzufügen
      case 'gemini':
        // responseData = await handleGeminiRequest(prompt, model, apiKey);
        responseData = { choices: [{ message: { role: "assistant", content: `(Gemini-Platzhalter: Hätte jetzt mit ${model} geantwortet.)` } }] };
        break;
      case 'anthropic':
         // responseData = await handleAnthropicRequest(prompt, model, apiKey);
         responseData = { choices: [{ message: { role: "assistant", content: `(Anthropic-Platzhalter: Hätte jetzt mit ${model} geantwortet.)` } }] };
        break;
      case 'perplexity':
         // responseData = await handlePerplexityRequest(prompt, model, apiKey);
         responseData = { choices: [{ message: { role: "assistant", content: `(Perplexity-Platzhalter: Hätte jetzt mit ${model} geantwortet.)` } }] };
        break;
      default:
        console.warn(`Nicht unterstützter Provider: ${provider}`);
        throw new Error(`Provider '${provider}' wird nicht unterstützt.`);
    }

    return new Response(JSON.stringify({ data: responseData }), { // Sende die rohe KI-Antwort zurück
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unerwarteter Fehler in Edge Function:", error.message);
    // Sende den Fehler als JSON zurück
    return new Response(JSON.stringify({ 
        error: "Internal Server Error", 
        detail: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

