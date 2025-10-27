import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 k1w1-handler: Request empfangen')
    
    const body: RequestBody = await req.json()
    const { messages, apiKey, provider, model } = body

    console.log(`📊 Provider: ${provider}, Model: ${model}, Messages: ${messages?.length || 0}`)

    // Validierung
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required')
    }
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API Key is required')
    }
    if (!provider) {
      throw new Error('Provider is required')
    }
    if (!model) {
      throw new Error('Model is required')
    }

    let response: string = '';

    // ========================================================================
    // GROQ
    // ========================================================================
    if (provider === 'groq') {
      console.log(`🚀 Calling Groq API...`)
      
      const groqModel = model === 'auto-groq' ? 'llama-3.3-70b-versatile' : model
      
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: groqModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 4000,
        }),
      })

      if (!groqRes.ok) {
        const errorText = await groqRes.text()
        console.error(`❌ Groq Error (${groqRes.status}):`, errorText)
        throw new Error(`Groq API Error (${groqRes.status}): ${errorText.substring(0, 200)}`)
      }

      const data = await groqRes.json()
      response = data.choices?.[0]?.message?.content || ''
      
      if (!response) {
        throw new Error('Groq returned empty response')
      }
      
      console.log(`✅ Groq Response: ${response.length} chars`)

    // ========================================================================
    // GEMINI
    // ========================================================================
    } else if (provider === 'gemini') {
      console.log(`🤖 Calling Gemini API...`)
      
      // Konvertiere Messages für Gemini-Format
      const geminiMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))

      const systemInstruction = messages.find(m => m.role === 'system')?.content || ''

      const requestBody: any = {
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        },
      }

      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }]
        }
      }

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      )

      if (!geminiRes.ok) {
        const errorText = await geminiRes.text()
        console.error(`❌ Gemini Error (${geminiRes.status}):`, errorText)
        throw new Error(`Gemini API Error (${geminiRes.status}): ${errorText.substring(0, 200)}`)
      }

      const data = await geminiRes.json()
      response = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
      if (!response) {
        throw new Error('Gemini returned empty response')
      }
      
      console.log(`✅ Gemini Response: ${response.length} chars`)

    // ========================================================================
    // OPENAI
    // ========================================================================
    } else if (provider === 'openai') {
      console.log(`🔵 Calling OpenAI API...`)
      
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 4000,
        }),
      })

      if (!openaiRes.ok) {
        const errorText = await openaiRes.text()
        console.error(`❌ OpenAI Error (${openaiRes.status}):`, errorText)
        throw new Error(`OpenAI API Error (${openaiRes.status}): ${errorText.substring(0, 200)}`)
      }

      const data = await openaiRes.json()
      response = data.choices?.[0]?.message?.content || ''
      
      if (!response) {
        throw new Error('OpenAI returned empty response')
      }
      
      console.log(`✅ OpenAI Response: ${response.length} chars`)

    // ========================================================================
    // ANTHROPIC
    // ========================================================================
    } else if (provider === 'anthropic') {
      console.log(`🟣 Calling Anthropic API...`)
      
      const anthropicMessages = messages.filter(m => m.role !== 'system')
      const systemMessage = messages.find(m => m.role === 'system')?.content || ''

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: anthropicMessages,
          system: systemMessage,
          max_tokens: 4000,
          temperature: 0.7,
        }),
      })

      if (!anthropicRes.ok) {
        const errorText = await anthropicRes.text()
        console.error(`❌ Anthropic Error (${anthropicRes.status}):`, errorText)
        throw new Error(`Anthropic API Error (${anthropicRes.status}): ${errorText.substring(0, 200)}`)
      }

      const data = await anthropicRes.json()
      response = data.content?.[0]?.text || ''
      
      if (!response) {
        throw new Error('Anthropic returned empty response')
      }
      
      console.log(`✅ Anthropic Response: ${response.length} chars`)

    } else {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    // Success Response
    return new Response(
      JSON.stringify({ response }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('❌ k1w1-handler Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal Server Error',
        details: error.toString(),
        stack: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
