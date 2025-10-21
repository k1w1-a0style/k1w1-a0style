// WICHTIG: Stelle sicher, dass diese Abhängigkeiten installiert sind
// (sollten sie aber von vorher noch sein)
// npm install groq-sdk openai @google/generative-ai @anthropic-ai/sdk

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Groq from 'npm:groq-sdk'
import OpenAI from 'npm:openai'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'
import Anthropic from 'npm:@anthropic-ai/sdk'

// Helper-Typ für die erwartete Anfrage (aus unserer App)
interface RequestBody {
  provider: 'groq' | 'openai' | 'gemini' | 'anthropic'
  model: string
  apiKey: string
  message: string // Unsere App sendet 'message', nicht 'messages'
}

// CORS-Header (direkt hier definiert, keine extra Datei nötig)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log('k1w1-handler Function (Korrigierte Version) gestartet.');

serve(async (req) => {
  // Handle Preflight-Requests (OPTIONS) für CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Lese und parse den Request Body
    const body: RequestBody = await req.json()
    // Wichtig: Wir erwarten 'message' von der App
    const { provider, model, apiKey, message } = body

    if (!provider || !model || !apiKey || !message) {
      throw new Error('Fehlende Parameter: provider, model, apiKey, oder message')
    }

    let aiResponseText: string | null = ''

    // 2. Wähle den Anbieter basierend auf dem 'provider'-Feld
    switch (provider) {
      
      // --- GROQ ---
      case 'groq': {
        console.log(`Verarbeite Groq: Model=${model}`)
        const groq = new Groq({ apiKey: apiKey })
        const chatCompletion = await groq.chat.completions.create({
          // Groq erwartet 'messages' Array
          messages: [{ role: 'user', content: message }],
          model: model, // 'auto-groq' wird schon in der App aufgelöst
        })
        aiResponseText = chatCompletion.choices[0]?.message?.content
        break
      }

      // --- OPENAI ---
      case 'openai': {
        console.log(`Verarbeite OpenAI: Model=${model}`)
        const openai = new OpenAI({ apiKey: apiKey })
        const chatCompletion = await openai.chat.completions.create({
          // OpenAI erwartet 'messages' Array
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
        // Wichtig: Gemini erwartet den Modellnamen im getGenerativeModel Aufruf
        const geminiModel = genAI.getGenerativeModel({ model: model })
        // Gemini erwartet einen einfachen String für generateContent
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
          max_tokens: 1024, // Sinnvoller Standardwert
          // Anthropic erwartet 'messages' Array
          messages: [{ role: 'user', content: message }],
        })
        // Anthropic gibt die Antwort in einem Array zurück
        // @ts-ignore (Typ-Sicherheit für Content-Block)
        aiResponseText = msg.content[0]?.text
        break
      }

      // Perplexity wurde entfernt

      default:
        throw new Error(`Unbekannter Anbieter: ${provider}`)
    }

    // 3. Sende die erfolgreiche JSON-Antwort zurück (wie von der App erwartet)
    return new Response(JSON.stringify({ response: aiResponseText || 'Keine Antwort erhalten.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    // 4. Handle Fehler (API-Fehler etc.)
    console.error('Fehler in k1w1-handler:', error) // Logge den ganzen Fehler
    
    let statusCode = 500 // Standard-Fehlercode
    let errorMessage = error.message

    // Versuche spezifischere Statuscodes und Nachrichten zu extrahieren
    if (error instanceof Error) {
        // OpenAI / Groq / Perplexity Fehler (haben oft 'status')
        // @ts-ignore
        if (error.status) statusCode = error.status
        // Gemini Fehler (haben oft 'code') - ungenügendes Kontingent
        // @ts-ignore
        if (error.code === 'insufficient_quota') statusCode = 429
        // Anthropic Fehler (haben oft 'type')
        // @ts-ignore
        if (error.type === 'authentication_error') statusCode = 401
         // @ts-ignore
        if (error.type === 'invalid_request_error' && error.message.includes('credit balance')) statusCode = 400 // Speziell für Anthropic Credit-Fehler
    }


    // Gib den Fehler als JSON zurück
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode, // Sende 4xx oder 500
    })
  }
})

