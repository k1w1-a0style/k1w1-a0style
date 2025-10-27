import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 EAS Build Trigger called')

    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
    const GITHUB_REPO = 'K1W1-Pro-Plus/k1w1-a0style'

    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured in Supabase')
    }

    console.log('📤 Triggering GitHub Action...')

    const githubRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/trigger-eas-build.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {}
        }),
      }
    )

    if (!githubRes.ok) {
      const errorText = await githubRes.text()
      console.error(`❌ GitHub API Error (${githubRes.status}):`, errorText)
      throw new Error(`GitHub API Error (${githubRes.status}): ${errorText}`)
    }

    console.log('✅ GitHub Action triggered successfully')

    return new Response(
      JSON.stringify({ 
        message: 'EAS Build erfolgreich gestartet',
        status: 'triggered'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('❌ trigger-eas-build Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
