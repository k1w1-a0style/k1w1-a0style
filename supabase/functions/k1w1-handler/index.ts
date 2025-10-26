import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Groq from 'npm:groq-sdk'
import OpenAI from 'npm:openai'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from 'npm:@google/generative-ai' // Safety import
import Anthropic from 'npm:@anthropic-ai/sdk'

interface PromptMessage { role: 'system' | 'user' | 'assistant'; content: string; }
interface RequestBody { provider: 'groq' | 'openai' | 'gemini' | 'anthropic'; model: string; apiKey: string; messages: PromptMessage[]; }

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

console.log('k1w1-handler Function gestartet (Version 2.1 - Robuster + Gemini Fix)')

// Helper für Gemini (konvertiert System+User/Assistant zu User/Model)
function convertToGemini(messages: PromptMessage[]) {
    const geminiMessages: { role: 'user' | 'model', parts: { text: string }[] }[] = [];
    let systemPrompt = '';
    messages.forEach(msg => {
        if (msg.role === 'system') {
            systemPrompt = (systemPrompt ? systemPrompt + '\n' : '') + msg.content;
        } else if (msg.role === 'user') {
            // Füge System-Prompt zur *ersten* User-Nachricht hinzu
            const userContent = systemPrompt ? `${systemPrompt}\n\nUSER FRAGT:\n${msg.content}` : msg.content;
            geminiMessages.push({ role: 'user', parts: [{ text: userContent }] });
            systemPrompt = ''; // System-Prompt nur einmal hinzufügen
        } else if (msg.role === 'assistant') {
            geminiMessages.push({ role: 'model', parts: [{ text: msg.content }] });
        }
    });
    // Falls nur System-Prompt da war (sollte nicht passieren, aber sicher ist sicher)
    if (systemPrompt && geminiMessages.length === 0) {
         geminiMessages.push({ role: 'user', parts: [{ text: systemPrompt }] });
    }
    return geminiMessages;
}

// ✅ Safety Settings für Gemini (weniger Blockaden bei Code)
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

  try {
    const body: RequestBody = await req.json();
    const { provider, model, apiKey, messages } = body;
    if (!provider || !model || !apiKey || !messages || messages.length === 0) { throw new Error('Fehlende Parameter: provider, model, apiKey, oder messages Array') }

    console.log(`Anfrage: ${provider} / ${model} (${messages.length} Nachrichten)`);
    let aiResponseText: string | null = '';
    const lastUserMessage = messages[messages.length - 1].content; // Brauchen wir für Gemini Chat

    switch (provider) {
      case 'groq': {
        const groq = new Groq({ apiKey: apiKey });
        const chatCompletion = await groq.chat.completions.create({
          messages: messages as Groq.Chat.Completions.CompletionCreateParams.Message[],
          model: model, temperature: 0.3, max_tokens: 8000 // Temp runter für JSON
        });
        aiResponseText = chatCompletion.choices[0]?.message?.content || '';
        break;
      }
      case 'openai': {
        const openai = new OpenAI({ apiKey: apiKey });
        const chatCompletion = await openai.chat.completions.create({
          messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          model: model, temperature: 0.3 // Temp runter für JSON
        });
        aiResponseText = chatCompletion.choices[0]?.message?.content || '';
        break;
      }
      case 'gemini': {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model: model, safetySettings }); // ✅ Safety Settings
        
        // Konvertiere die gesamte History
        const geminiHistory = convertToGemini(messages.slice(0, -1));

        const chat = geminiModel.startChat({
          history: geminiHistory,
          generationConfig: { temperature: 0.4 } // Temp runter für JSON
        });
        const result = await chat.sendMessage(lastUserMessage); // Sende nur die letzte User-Nachricht
        aiResponseText = result.response.text();
        break;
      }
      case 'anthropic': {
        const anthropic = new Anthropic({ apiKey: apiKey });
        const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
        const userMessages = messages.filter(m => m.role !== 'system') as Anthropic.Messages.MessageParam[];
        const msg = await anthropic.messages.create({
          model: model, max_tokens: 4096, system: systemPrompt, messages: userMessages, temperature: 0.3 // Temp runter für JSON
        });
        // @ts-ignore // Anthropic SDK Typisierung ist manchmal unvollständig
        aiResponseText = msg.content[0]?.text || '';
        break;
      }
      default: throw new Error('Unbekannter Anbieter: ' + provider);
    }

    console.log(`Erfolg: ${provider} (${aiResponseText?.length || 0} Zeichen)`);
    return new Response(JSON.stringify({ response: aiResponseText || '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error(`Fehler in k1w1-handler (${error.name}):`, error.message);
    let statusCode = 500;
    let errorMessage = error.message;
    if (error instanceof Error) {
        // @ts-ignore
        if (error.status) statusCode = error.status;
        // @ts-ignore
        if (error.code === 'insufficient_quota') statusCode = 429; // Rate limit / Quota
        // @ts-ignore
        if (error.type === 'authentication_error') statusCode = 401; // Invalid API Key
        // @ts-ignore
        if (error.type === 'invalid_request_error') statusCode = 400; // Bad request (z.B. falsches Modell)
        // @ts-ignore
         if (error.message?.includes('SAFETY')) { // Gemini Safety Block
             statusCode = 400; // Behandle als Bad Request
             errorMessage = "Gemini Safety Block: Die Antwort wurde aufgrund von Sicherheitsrichtlinien blockiert.";
             console.warn("Gemini Safety Block detektiert.");
         }
    }
    // Detailliertere Fehlermeldung loggen
    console.error(`Status Code: ${statusCode}, Message: ${errorMessage}`);
    // @ts-ignore
    if(error.response?.data) console.error("Response Data:", error.response.data);

    return new Response(JSON.stringify({ error: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: statusCode });
  }
})
