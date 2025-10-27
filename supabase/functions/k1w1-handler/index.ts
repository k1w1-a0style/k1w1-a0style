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
    console.log('📋 Method:', req.method)
    console.log('📋 Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())))
    
    // KRITISCHER FIX: Body parsing mit Error Handling
    let body: RequestBody;
    const rawBody = await req.text();
    console.log('📋 Raw Body Length:', rawBody.length)
    
    try {
      body = JSON.parse(rawBody);
      console.log('📋 Parsed Body Keys:', Object.keys(body))
    } catch (e) {
      console.error('❌ JSON Parse Error:', e)
      console.error('❌ Raw Body (first 500 chars):', rawBody.substring(0, 500))
      throw new Error('Invalid JSON in request body')
    }
    
    const { messages, apiKey, provider, model } = body
    
    // KRITISCHES LOGGING
    console.log(`📊 Provider: ${provider}, Model: ${model}`)
    console.log(`📝 Messages Count: ${messages?.length || 0}`)
    console.log(`🔑 API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`)
    
    if (messages && messages.length > 0) {
      console.log('📝 First Message:', JSON.stringify(messages[0]))
    }
    
    // Validierung
    if (!messages || !Array.isArray(messages)) {
      console.error('❌ Messages invalid type:', typeof messages)
      throw new Error('Messages must be an array')
    }
    
    if (messages.length === 0) {
      console.error('❌ Messages array is empty')
      throw new Error('Messages array cannot be empty')
    }
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
      console.error('❌ API Key invalid:', apiKey ? 'too short' : 'missing')
      throw new Error('Valid API Key is required')
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
      console.log(`🚀 Calling Groq API with key: ${apiKey.substring(0, 10)}...`)
      console.log(`📝 Sending ${messages.length} messages to model: ${model}`)
      
      const groqModel = model === 'auto-groq' ? 'llama-3.3-70b-versatile' : model
      
      const groqBody = {
        model: groqModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
      };
      
      console.log('📤 Groq Request Body:', JSON.stringify(groqBody).substring(0, 200))
      
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groqBody),
      })

      const responseText = await groqRes.text()
      console.log(`📥 Groq Response Status: ${groqRes.status}`)
      console.log(`📥 Groq Response (first 500 chars): ${responseText.substring(0, 500)}`)
      
      if (!groqRes.ok) {
        console.error(`❌ Groq Error (${groqRes.status}):`, responseText)
        
        // Spezielle Behandlung für verschiedene Fehler
        if (responseText.includes('organization_restricted')) {
          throw new Error('GROQ ACCOUNT GESPERRT! Verwende einen anderen Provider (Gemini/OpenAI) oder erstelle einen NEUEN Groq Account mit ANDERER Email!')
        }
        if (responseText.includes('rate_limit')) {
          throw new Error('Groq Rate Limit erreicht. Bitte warten oder anderen Key verwenden.')
        }
        if (responseText.includes('invalid_api_key')) {
          throw new Error('Ungültiger Groq API Key')
        }
        
        throw new Error(`Groq API Error (${groqRes.status}): ${responseText.substring(0, 200)}`)
      }

      try {
        const data = JSON.parse(responseText)
        response = data.choices?.[0]?.message?.content || ''
      } catch (e) {
        console.error('❌ Groq Response Parse Error:', e)
        throw new Error('Invalid response from Groq API')
      }
      
      if (!response) {
        throw new Error('Groq returned empty response')
      }
      
      console.log(`✅ Groq Response: ${response.length} chars`)
    }
    
    // ========================================================================
    // GEMINI
    // ========================================================================
    else if (provider === 'gemini') {
      console.log(`🤖 Calling Gemini API with key: ${apiKey.substring(0, 10)}...`)
      console.log(`📝 Sending ${messages.length} messages to model: ${model}`)
      
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
      
      console.log('📤 Gemini Request (partial):', JSON.stringify(requestBody).substring(0, 200))

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      )

      const responseText = await geminiRes.text()
      console.log(`📥 Gemini Response Status: ${geminiRes.status}`)
      
      if (!geminiRes.ok) {
        console.error(`❌ Gemini Error (${geminiRes.status}):`, responseText)
        throw new Error(`Gemini API Error (${geminiRes.status}): ${responseText.substring(0, 200)}`)
      }

      try {
        const data = JSON.parse(responseText)
        response = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } catch (e) {
        console.error('❌ Gemini Response Parse Error:', e)
        throw new Error('Invalid response from Gemini API')
      }
      
      if (!response) {
        throw new Error('Gemini returned empty response')
      }
      
      console.log(`✅ Gemini Response: ${response.length} chars`)
    }
    
    // ========================================================================
    // OPENAI
    // ========================================================================
    else if (provider === 'openai') {
      console.log(`🔵 Calling OpenAI API with key: ${apiKey.substring(0, 10)}...`)
      
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

      const responseText = await openaiRes.text()
      
      if (!openaiRes.ok) {
        console.error(`❌ OpenAI Error (${openaiRes.status}):`, responseText)
        throw new Error(`OpenAI API Error (${openaiRes.status}): ${responseText.substring(0, 200)}`)
      }

      try {
        const data = JSON.parse(responseText)
        response = data.choices?.[0]?.message?.content || ''
      } catch (e) {
        console.error('❌ OpenAI Response Parse Error:', e)
        throw new Error('Invalid response from OpenAI API')
      }
      
      if (!response) {
        throw new Error('OpenAI returned empty response')
      }
      
      console.log(`✅ OpenAI Response: ${response.length} chars`)
    }
    
    // ========================================================================
    // ANTHROPIC
    // ========================================================================
    else if (provider === 'anthropic') {
      console.log(`🟣 Calling Anthropic API with key: ${apiKey.substring(0, 10)}...`)
      
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

      const responseText = await anthropicRes.text()
      
      if (!anthropicRes.ok) {
        console.error(`❌ Anthropic Error (${anthropicRes.status}):`, responseText)
        throw new Error(`Anthropic API Error (${anthropicRes.status}): ${responseText.substring(0, 200)}`)
      }

      try {
        const data = JSON.parse(responseText)
        response = data.content?.[0]?.text || ''
      } catch (e) {
        console.error('❌ Anthropic Response Parse Error:', e)
        throw new Error('Invalid response from Anthropic API')
      }
      
      if (!response) {
        throw new Error('Anthropic returned empty response')
      }
      
      console.log(`✅ Anthropic Response: ${response.length} chars`)
    } 
    else {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    // Success Response
    console.log('✅ Returning success response')
    return new Response(
      JSON.stringify({ response }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ k1w1-handler Error:', error.message)
    console.error('Stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
