import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Groq from 'npm:groq-sdk'
import OpenAI from 'npm:openai'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'
import Anthropic from 'npm:@anthropic-ai/sdk'

interface RequestBody {
  provider: 'groq' | 'openai' | 'gemini' | 'anthropic'
  model: string
  apiKey: string
  message: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log('k1w1-handler Function gestartet.')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { provider, model, apiKey, message } = body

    if (!provider || !model || !apiKey || !message) {
      throw new Error('Fehlende Parameter: provider, model, apiKey, oder message')
    }

    console.log('Anfrage: ' + provider + ' / ' + model)

    let aiResponseText: string | null = ''

    switch (provider) {
      case 'groq': {
        const groq = new Groq({ apiKey: apiKey })
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'user', content: message }
          ],
          model: model,
          temperature: 0.7,
          max_tokens: 8000
        })
        aiResponseText = chatCompletion.choices[0]?.message?.content || ''
        break
      }

      case 'openai': {
        const openai = new OpenAI({ apiKey: apiKey })
        const chatCompletion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: message }],
          model: model,
        })
        aiResponseText = chatCompletion.choices[0]?.message?.content || ''
        break
      }

      case 'gemini': {
        const genAI = new GoogleGenerativeAI(apiKey)
        const geminiModel = genAI.getGenerativeModel({ model: model })
        const result = await geminiModel.generateContent(message)
        aiResponseText = result.response.text()
        break
      }

      case 'anthropic': {
        const anthropic = new Anthropic({ apiKey: apiKey })
        const msg = await anthropic.messages.create({
          model: model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: message }],
        })
        // @ts-ignore
        aiResponseText = msg.content[0]?.text || ''
        break
      }

      default:
        throw new Error('Unbekannter Anbieter: ' + provider)
    }

    console.log('Erfolg: ' + provider + ' (' + (aiResponseText?.length || 0) + ' Zeichen)')

    return new Response(JSON.stringify({ response: aiResponseText || 'Keine Antwort erhalten.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Fehler in k1w1-handler:', error)

    let statusCode = 500
    let errorMessage = error.message

    if (error instanceof Error) {
      // @ts-ignore
      if (error.status) statusCode = error.status
      // @ts-ignore
      if (error.code === 'insufficient_quota') statusCode = 429
      // @ts-ignore
      if (error.type === 'authentication_error') statusCode = 401
      // @ts-ignore
      if (error.type === 'invalid_request_error') statusCode = 400
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    })
  }
})
