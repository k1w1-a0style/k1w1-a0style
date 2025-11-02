// supabase/functions/trigger-eas-build/index.ts (v7.3 - Final Fix)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Octokit } from "https://esm.sh/@octokit/rest@20.0.1"

interface ProjectFile { path: string; content: string; }
interface RequestBody { githubRepo: string; githubToken: string; files: ProjectFile[]; }
interface BuildJob { id: number; }
interface GitTreeElement { path: string; mode: '100644'; type: 'blob'; sha: string | null; }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const MAX_FILES = 200
const MAX_FILE_SIZE = 1_500_000 // 1.5MB

function guessEncoding(content: string, path: string): 'utf-8' | 'base64' {
  if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.ico')) {
    return 'base64'
  }
  let nonAscii = 0;
  for (let i = 0; i < Math.min(content.length, 500); i++) {
    const code = content.charCodeAt(i);
    if (code === 0) return 'base64';
    if (code > 127) nonAscii++;
  }
  if (nonAscii / 500 > 0.1) return 'base64';
  return 'utf-8';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let newJobId: number | null = null;
  let supabaseAdmin: any = null;
  let owner: string, repo: string;
  let githubToken: string;
  let octokit: Octokit;

  try {
    console.log('🚀 trigger-eas-build (v7.3 - Final Fix) called')

    // 1. ENV Checks
    const SERVICE_ROLE_KEY = Deno.env.get('K1W1_SUPABASE_SERVICE_ROLE_KEY')
    const SUPABASE_URL = Deno.env.get('K1W1_SUPABASE_URL')
    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      throw new Error('Server misconfigured: missing Supabase env vars')
    }
    supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    
    // 2. Parse body
    const body: RequestBody = await req.json() as RequestBody
    
    // --- KORREKTUR V7.3: Zuweisungen an den Anfang verschoben ---
    githubToken = body.githubToken;
    [owner, repo] = body.githubRepo.split('/') 
    
    if (!body.githubRepo || !body.githubRepo.includes('/')) throw new Error("'githubRepo' missing or invalid")
    if (!githubToken) throw new Error("'githubToken' missing")
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) throw new Error("'files' array missing or empty")
    // --- ENDE KORREKTUR V7.3 ---

    console.log(`Job requested for ${body.files.length} files in ${body.githubRepo}`)

    // 3. Create DB job
    const { data: newJob, error: dbError } = await supabaseAdmin
      .from('build_jobs')
      .insert({ github_repo: body.githubRepo, status: 'pending' })
      .select('id')
      .single()
    if (dbError) throw new Error(`DB insert failed: ${dbError.message}`)
    newJobId = (newJob as BuildJob).id
    console.log(`✅ Job ${newJobId} in DB erstellt.`)

    // 4. Octokit init
    console.log(`🔧 Initialisiere Octokit mit Token: ${githubToken.substring(0, 10)}...`)
    octokit = new Octokit({ auth: githubToken })
    console.log('✅ Octokit-Client initialisiert.')

    // 4.1 Get branch ref
    let parentCommitSha: string | null = null
    const branchCandidates = ['main', 'master']
    let usedBranch = null
    for (const b of branchCandidates) {
      try {
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${b}` })
        parentCommitSha = refData.object.sha
        usedBranch = b
        console.log(`✅ Found branch: ${b} -> commit ${parentCommitSha}`)
        break
      } catch (err: any) { console.warn(`❌ Branch ${b} not found: ${err.message}`) }
    }
    if (!parentCommitSha || !usedBranch) {
      // DIESER FEHLER SOLLTE JETZT NUR BEI FALSCHEM REPO/TOKEN auftauchen
      throw new Error('No branch found (main/master) or token lacks repo access')
    }

    // 4.2 Get commit tree SHA
    const { data: commitObject } = await octokit.git.getCommit({ owner, repo, commit_sha: parentCommitSha })
    const baseTreeSha = commitObject.tree.sha
    console.log(`Base Tree SHA: ${baseTreeSha}`)

    // 4.3 Create blobs
    console.log(`Erstelle ${body.files.length} Blobs...`)
    const blobPromises = body.files.map(file => {
      const encoding = guessEncoding(file.content, file.path)
      return octokit.git.createBlob({ owner, repo, content: file.content, encoding: encoding })
    })
    const blobResults = await Promise.all(blobPromises)
    const tree: GitTreeElement[] = blobResults.map((b, i) => ({
      path: body.files[i].path, mode: '100644', type: 'blob', sha: b.data.sha,
    }))
    console.log("Blobs erstellt.")

    // 4.4 Create tree
    const { data: treeData } = await octokit.git.createTree({ owner, repo, tree, base_tree: baseTreeSha })

    // 4.5 Create commit
    const commitMessage = `K1W1 App Build v${newJobId}`
    const { data: commitData } = await octokit.git.createCommit({
      owner, repo, message: commitMessage, tree: treeData.sha, parents: [parentCommitSha],
    })

    // 4.6 Update ref (Push)
    await octokit.git.updateRef({ owner, repo, ref: `heads/${usedBranch}`, sha: commitData.sha })
    console.log("✅ Code erfolgreich nach GitHub gepusht.")

    // 5. Update job status (auf 'pushed')
    await supabaseAdmin.from('build_jobs').update({ status: 'pushed', github_commit_sha: commitData.sha }).eq('id', newJobId)

    // 6. Workflow manuell auslösen (Dispatch)
    await octokit.actions.createWorkflowDispatch({
        owner, repo, workflow_id: 'deploy-supabase-functions.yml', ref: usedBranch, inputs: { job_id: String(newJobId) }
    });
    console.log("✅ Workflow manuell ausgelöst.")

    return new Response(
      JSON.stringify({
        message: 'Code gepusht und Build ausgelöst.',
        job_id: newJobId,
        github_commit_sha: commitData.sha
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('❌ trigger-eas-build Unhandled Error:', String(error?.message || error))
    console.error('Stack:', error.stack)
    if (newJobId && supabaseAdmin) {
      await supabaseAdmin
        .from('build_jobs')
        .update({ status: 'error', eas_build_id: `Error: ${String(error?.message || '').substring(0,100)}` })
        .eq('id', newJobId)
    }
    return new Response(
      JSON.stringify({ error: String(error?.message || 'Unknown'), details: error.stack }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
