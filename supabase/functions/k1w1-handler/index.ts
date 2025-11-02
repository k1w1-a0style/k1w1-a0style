

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Definiere die CORS-Header
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Typ-Definitionen für die Anfrage
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: Message[];
  apiKey: string;
  provider: 'groq' | 'gemini' | 'openai' | 'anthropic';
  model: string;
}

/**
 * Hilfsfunktion, um den Request-Body sicher zu parsen und Fehlerdetails zu loggen.
 */
async function parseRequestBody(req: Request): Promise<RequestBody> {
  const rawBody = await req.text();
  if (!rawBody) {
    throw new Error('Request body is empty');
  }
  try {
    return JSON.parse(rawBody);
  } catch (e) {
    console.error('❌ JSON Parse Error:', e.message);
    console.error('❌ Raw Body (first 500 chars):', rawBody.substring(0, 500));
    throw new Error(`Invalid JSON in request body: ${e.message}`);
  }
}

/**
 * Hilfsfunktion zur Validierung des Request-Bodys.
 */
function validateRequestBody({ messages, apiKey, provider, model }: RequestBody) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages must be a non-empty array');
  }
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
    throw new Error('Valid API Key is required');
  }
  if (!provider || !model) {
    throw new Error('Provider and model are required');
  }
}

/**
 * Erstellt den API-Aufruf (URL, Header, Body) basierend auf dem Provider.
 */
function buildApiRequest(body: RequestBody): { apiUrl: string; headers: Record<string, string>; requestBody: any } {
  const { messages, apiKey, provider, model } = body;

  // System-Prompt extrahieren (wird für Gemini und Anthropic benötigt)
  const systemInstruction = messages.find(m => m.role === 'system');
  // Nachrichten ohne System-Prompt
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  let apiUrl: string;
  let headers: Record<string, string>;
  let requestBody: any;

  switch (provider) {
    case 'groq':
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      requestBody = {
        model: model === 'auto-groq' ? 'llama-3.3-70b-versatile' : model, // Fallback-Modell
        messages: messages, // Groq verwendet das OpenAI-Format inkl. 'system'
        temperature: 0.7,
        max_tokens: 4000,
      };
      break;

    case 'gemini':
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      requestBody = {
        contents: nonSystemMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model', // Gemini verwendet 'model' statt 'assistant'
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        },
      };
      // System-Instruktion KORREKT HINZUFÜGEN
      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction.content }]
        };
      }
      break;

    case 'openai':
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      requestBody = {
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
      };
      break;

    case 'anthropic':
      apiUrl = 'https://api.anthropic.com/v1/messages';
      headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      };
      requestBody = {
        model: model,
        messages: nonSystemMessages, // Anthropic erwartet Nachrichten ohne 'system'
        max_tokens: 4000,
        temperature: 0.7,
      };
      // System-Instruktion KORREKT HINZUFÜGEN
      if (systemInstruction) {
        requestBody.system = systemInstruction.content;
      }
      break;

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  return { apiUrl, headers, requestBody };
}

/**
 * Parst die Antwort der LLM-API.
 */
function parseApiResponse(provider: string, responseText: string): string {
  try {
    const data = JSON.parse(responseText);
    let response = '';

    switch (provider) {
      case 'groq':
      case 'openai':
        response = data.choices?.[0]?.message?.content || '';
        break;
      case 'gemini':
        response = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        break;
      case 'anthropic':
        response = data.content?.[0]?.text || '';
        break;
      default:
        throw new Error('Unknown provider in parseApiResponse');
    }
    
    if (!response) {
      throw new Error(`${provider} returned an empty response content`);
    }
    
    console.log(`✅ ${provider} Response: ${response.length} chars`);
    return response;

  } catch (e) {
    console.error(`❌ ${provider} Response Parse Error:`, e.message);
    throw new Error(`Invalid response from ${provider} API: ${e.message}`);
  }
}

/**
 * Haupt-Handler für die Edge Function
 */
serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parsen und Validieren
    const requestData = await parseRequestBody(req);
    validateRequestBody(requestData);
    
    const { provider, model, messages } = requestData;
    console.log(`📥 k1w1-handler: Request. Provider: ${provider}, Model: ${model}, Messages: ${messages.length}`);

    // 2. API-Request erstellen
    const { apiUrl, headers, requestBody } = buildApiRequest(requestData);

    // 3. API-Aufruf
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await apiResponse.text();

    if (!apiResponse.ok) {
      console.error(`❌ ${provider} Error (${apiResponse.status}):`, responseText.substring(0, 500));
      // KORREKTUR: Detailliertere Fehlermeldung an den Client senden
      throw new Error(`[${provider} API Error ${apiResponse.status}] ${responseText.substring(0, 200)}`);
    }

    // 4. Antwort parsen
    const response = parseApiResponse(provider, responseText);

    // 5. Erfolgreiche Antwort
    return new Response(
      JSON.stringify({ response }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    // 6. Zentrale Fehlerbehandlung
    console.error('❌ k1w1-handler Error:', error.message);
    console.error('Stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: error.message, // Nur die Nachricht senden
        details: error.stack, // Stack für optionales Debugging im Client
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});



