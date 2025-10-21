// WICHTIG: Du musst diese Abhängigkeiten in deinem Supabase-Projekt installieren!
// Führe im Verzeichnis `supabase/functions/k1w1-handler` aus:
// npm install groq-sdk openai @google/generative-ai @anthropic-ai/sdk
// (Deno/Supabase importiert diese meist automatisch, aber sicher ist sicher)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Groq from 'npm:groq-sdk'
import OpenAI from 'npm:openai'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'
import Anthropic from 'npm:@anthropic-ai/sdk'

// Helper-Typ für die erwartete Anfrage
interface RequestBody {
  provider: 'groq' | 'openai' | 'gemini' | 'anthropic' | 'perplexity'
  model: string
  apiKey: string
  message: string
}

// CORS-Header, wichtig für die App
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Erlaube Anfragen von überall
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Erlaube POST und OPTIONS
}

console.log('k1w1-handler Function gestartet.');

serve(async (req) => {
  // Handle Preflight-Requests (OPTIONS) für CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Lese und parse den Request Body
    const body: RequestBody = await req.json()
    const { provider, model, apiKey, message } = body

    if (!provider || !model || !apiKey || !message) {
      throw new Error('Fehlende Parameter: provider, model, apiKey, oder message')
    }

    let aiResponseText: string | null = ''

    // 2. Wähle den Anbieter basierend auf dem 'provider'-Feld
    switch (provider) {
      
      // --- GROQ --- (Funktioniert bei dir schon)
      case 'groq': {
        console.log(`Verarbeite Groq: Model=${model}`)
        const groq = new Groq({ apiKey: apiKey })
        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: message }],
          model: model,
        })
        aiResponseText = chatCompletion.choices[0]?.message?.content
        break
      }

      // --- OPENAI ---
      case 'openai': {
        console.log(`Verarbeite OpenAI: Model=${model}`)
        const openai = new OpenAI({ apiKey: apiKey })
        const chatCompletion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: message }],
          model: model,
        })
        aiResponseText = chatCompletion.choices[0]?.message?.content
        break
      }

      // --- GEMINI ---
      case 'gemini': {
        console.log(`Verarbeite Gemini: Model=${model}`)
        const genAI = new GoogleGenerativeAI(apiKey)
        const geminiModel = genAI.getGenerativeModel({ model: model })
        const result = await geminiModel.generateContent(message)
        aiResponseText = result.response.text()
        break
      }

      // --- ANTHROPIC ---
      case 'anthropic': {
        console.log(`Verarbeite Anthropic: Model=${model}`)
        const anthropic = new Anthropic({ apiKey: apiKey })
        const msg = await anthropic.messages.create({
          model: model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: message }],
        })
        // @ts-ignore (Typ-Sicherheit für Content-Block)
        aiResponseText = msg.content[0]?.text
        break
      }

      // --- PERPLEXITY --- (Verwendet OpenAI-kompatible API)
      case 'perplexity': {
        console.log(`Verarbeite Perplexity: Model=${model}`)
        const perplexity = new OpenAI({
          apiKey: apiKey,
          baseURL: 'https://api.perplexity.ai', // WICHTIG: Benutzerdefinierte URL
        })
        const chatCompletion = await perplexity.chat.completions.create({
          messages: [{ role: 'user', content: message }],
          model: model,
        })
        aiResponseText = chatCompletion.choices[0]?.message?.content
        break
      }

      default:
        throw new Error(`Unbekannter Anbieter: ${provider}`)
    }

    // 3. Sende die erfolgreiche Antwort zurück
    return new Response(JSON.stringify({ response: aiResponseText || 'Keine Antwort erhalten.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    // 4. Handle Fehler (z.B. falscher API-Key, Quota-Limit)
    console.error('Fehler in k1w1-handler:', error.message)
    
    // Versuche, den Statuscode aus dem API-Fehler zu extrahieren
    let statusCode = 500
    if (error.status) statusCode = error.status // Für OpenAI/Groq-Fehler
    if (error.code && error.code === 'insufficient_quota') statusCode = 429 // Gemini
    if (error.type === 'authentication_error') statusCode = 401 // Anthropic

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode, // Sende 429/401, wenn wir es wissen, sonst 500
    })
  }
})

