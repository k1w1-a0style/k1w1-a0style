// supabase/functions/check-eas-build/index.ts (v2.2 - robust)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface RequestBody {
  jobId: number;
  easToken: string;
}
interface BuildJob {
  id: number;
  status: string;
  eas_build_id: string | null;
  download_url: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    console.log('🔍 check-eas-build (v2.2) called')

    const SERVICE_ROLE_KEY = Deno.env.get('K1W1_SUPABASE_SERVICE_ROLE_KEY')
    const SUPABASE_URL = Deno.env.get('K1W1_SUPABASE_URL')
    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      throw new Error('Supabase Service Key oder URL nicht konfiguriert.')
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { jobId, easToken } = (await req.json()) as RequestBody
    if (!jobId) throw new Error("Fehler: 'jobId' fehlt.")
    if (!easToken) throw new Error("Fehler: 'easToken' fehlt.")

    const { data: job, error: dbError } = await supabaseAdmin
      .from('build_jobs')
      .select('id, status, eas_build_id, download_url')
      .eq('id', jobId)
      .single()
    if (dbError) throw new Error(`DB Fehler: ${dbError.message}`)
    const currentJob = job as BuildJob;
    console.log(`Checking Job ${jobId}. DB Status: ${currentJob.status}`)

    if (currentJob.status === 'success' || currentJob.status === 'error' || currentJob.status === 'pending' || currentJob.status === 'pushed') {
      console.log(`Status ist '${currentJob.status}'. Kein Expo API-Call nötig.`)
      return new Response(JSON.stringify(currentJob), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (currentJob.status === 'building' && !currentJob.eas_build_id) {
      console.error(`Inkonsistenz: Job ${jobId} ist 'building', aber 'eas_build_id' fehlt!`)
      return new Response(JSON.stringify(currentJob), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const expoApiUrl = `https://api.expo.dev/v2/build/by-id?buildId=${currentJob.eas_build_id}`
    const expoRes = await fetch(expoApiUrl, {
      headers: { 'Authorization': `Bearer ${easToken}` },
    })

    if (!expoRes.ok) {
      const errorText = await expoRes.text()
      console.error(`❌ Expo API Error (${expoRes.status}):`, errorText)
      if (expoRes.status === 401) throw new Error('Expo Token ist ungültig (401).')
      return new Response(JSON.stringify(currentJob), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const buildDetails = (await expoRes.json()).data
    const newStatus = buildDetails?.status || 'unknown'
    let newDownloadUrl = currentJob.download_url;
    let finalStatus = currentJob.status;

    if (newStatus === 'finished') {
      finalStatus = 'success'
      newDownloadUrl = buildDetails.artifacts?.buildUrl || null
      console.log(`✅ Build ${jobId} FERTIG. URL: ${newDownloadUrl}`)
    } else if (newStatus === 'errored') {
      finalStatus = 'error'
      console.log(`❌ Build ${jobId} FEHLGESCHLAGEN.`)
    } else {
      console.log(`Build ${jobId} läuft... (EAS Status: ${newStatus})`)
    }

    if (finalStatus !== currentJob.status || newDownloadUrl !== currentJob.download_url) {
      const { data: updatedJob, error: updateError } = await supabaseAdmin
        .from('build_jobs')
        .update({ status: finalStatus, download_url: newDownloadUrl })
        .eq('id', jobId)
        .select()
        .single()

      if (updateError) throw new Error(`DB Update Fehler: ${updateError.message}`)
      return new Response(JSON.stringify(updatedJob), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify(currentJob), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('❌ check-eas-build Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
