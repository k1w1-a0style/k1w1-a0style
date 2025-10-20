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
    // Einfache Auto-Logik (basierend auf deiner DOCX)
    if (prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('ui')) {
      effectiveModel = 'llama-3.3-70b-versatile';
    } else if (prompt.length > 500 || prompt.toLowerCase().includes('debug')) {
      effectiveModel = 'openai/gpt-oss-120b';
    } else if (prompt.length < 150) {
      effectiveModel = 'llama-3.1-8b-instant';
    } else {
      effectiveModel = 'openai/gpt-oss-20b';
    }
    console.log(`Auto-Groq hat gewählt: ${effectiveModel}`);
  }
  
  const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";
  
  const groqResponse = await fetch(groqApiUrl, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: effectiveModel,
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

// --- Platzhalter für Gemini ---
async function handleGeminiRequest(prompt: string, model: string, apiKey: string) {
  console.log(`Starte Gemini-Anfrage mit Modell: ${model}`);
  // const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  // const response = await fetch(geminiApiUrl, { ... });
  return {
    choices: [{
      message: {
        role: "assistant",
        content: `(Gemini-Platzhalter: Hätte jetzt mit ${model} geantwortet.)`
      }
    }]
  };
}

// --- Platzhalter für Anthropic (Claude) ---
async function handleAnthropicRequest(prompt: string, model: string, apiKey: string) {
  console.log(`Starte Anthropic-Anfrage mit Modell: ${model}`);
  // const anthropicApiUrl = "https://api.anthropic.com/v1/messages";
  // const response = await fetch(anthropicApiUrl, { ... });
  return {
    choices: [{
      message: {
        role: "assistant",
        content: `(Anthropic-Platzhalter: Hätte jetzt mit ${model} geantwortet.)`
      }
    }]
  };
}

// --- Platzhalter für Perplexity ---
async function handlePerplexityRequest(prompt: string, model: string, apiKey: string) {
  console.log(`Starte Perplexity-Anfrage mit Modell: ${model}`);
  // const perplexityApiUrl = "https://api.perplexity.ai/chat/completions";
  // const response = await fetch(perplexityApiUrl, { ... });
  return {
    choices: [{
      message: {
        role: "assistant",
        content: `(Perplexity-Platzhalter: Hätte jetzt mit ${model} geantwortet.)`
      }
    }]
  };
}


// --- Haupt-Handler (Router) ---
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
        provider = body.provider;
        model = body.model;
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
      case 'gemini':
        responseData = await handleGeminiRequest(prompt, model, apiKey);
        break;
      case 'anthropic':
         responseData = await handleAnthropicRequest(prompt, model, apiKey);
        break;
      case 'perplexity':
         responseData = await handlePerplexityRequest(prompt, model, apiKey);
        break;
      default:
        console.warn(`Nicht unterstützter Provider: ${provider}`);
        throw new Error(`Provider '${provider}' wird nicht unterstützt.`);
    }

    return new Response(JSON.stringify({ data: responseData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unerwarteter Fehler in Edge Function:", error.message);
    return new Response(JSON.stringify({ 
        error: "Internal Server Error", 
        detail: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

