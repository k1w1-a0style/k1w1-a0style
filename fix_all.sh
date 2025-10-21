#!/bin/bash
set -e

echo "🔧 Repariere Edge Function..."
cat > supabase/functions/k1w1-handler/index.ts <<'EDGEFUNC'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Nur POST-Anfragen erlaubt' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { provider, model, apiKey, prompt } = body;

    console.log('📨 Edge Function empfing:', { provider, model, hasKey: !!apiKey, hasPrompt: !!prompt });

    if (!provider || !model || !apiKey || !prompt) {
      console.error('❌ Fehlende Parameter:', { provider: !!provider, model: !!model, apiKey: !!apiKey, prompt: !!prompt });
      return new Response(JSON.stringify({
        error: `Fehlende Parameter. provider=${!!provider}, model=${!!model}, apiKey=${!!apiKey}, prompt=${!!prompt}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let responseData: any;

    switch (provider) {
      case 'groq':
        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model, messages: [{ role: 'user', content: prompt }] }),
        });
        if (!groqResp.ok) throw new Error(`Groq: ${groqResp.status} - ${await groqResp.text()}`);
        const groqData = await groqResp.json();
        responseData = { response: groqData.choices[0].message.content };
        break;

      case 'openai':
        const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model, messages: [{ role: 'user', content: prompt }] }),
        });
        if (!openaiResp.ok) throw new Error(`OpenAI: ${openaiResp.status} - ${await openaiResp.text()}`);
        const openaiData = await openaiResp.json();
        responseData = { response: openaiData.choices[0].message.content };
        break;

      case 'gemini':
        const geminiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (!geminiResp.ok) throw new Error(`Gemini: ${geminiResp.status} - ${await geminiResp.text()}`);
        const geminiData = await geminiResp.json();
        responseData = { response: geminiData.candidates[0].content.parts[0].text };
        break;

      case 'anthropic':
        const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: model, messages: [{ role: 'user', content: prompt }], max_tokens: 1024 }),
        });
        if (!anthropicResp.ok) throw new Error(`Anthropic: ${anthropicResp.status} - ${await anthropicResp.text()}`);
        const anthropicData = await anthropicResp.json();
        responseData = { response: anthropicData.content[0].text };
        break;

      case 'perplexity':
        const perplexityResp = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model, messages: [{ role: 'user', content: prompt }] }),
        });
        if (!perplexityResp.ok) throw new Error(`Perplexity: ${perplexityResp.status} - ${await perplexityResp.text()}`);
        const perplexityData = await perplexityResp.json();
        responseData = { response: perplexityData.choices[0].message.content };
        break;

      default:
        return new Response(JSON.stringify({ error: `Ungültiger Provider: ${provider}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    console.log('✅ Erfolgreiche Antwort von', provider);
    return new Response(JSON.stringify(responseData), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Edge Function Fehler:', error.message);
    return new Response(JSON.stringify({ error: `Server Fehler: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
EDGEFUNC

echo "🔧 Repariere ChatScreen Response Parsing..."
cp screens/ChatScreen.tsx screens/ChatScreen.tsx.backup3
sed -i 's|data?.data?.choices?```math
0```?.message?.content|data?.response|' screens/ChatScreen.tsx

echo "✅ Fertig! Deploye jetzt..."
