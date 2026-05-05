import { getBranchHeadSha, getDefaultBranch } from "../infra/github/branchOps";
import { createOrUpdateFile, getRepoFileText } from "../infra/github/files";
import { WORKFLOW_TEMPLATES } from "../shared/workflows/managedWorkflowTemplates";

export type CiLiteWorkflowBootstrapStatus = "created" | "repaired" | "current" | "skipped_tokenless" | "skipped_unknown_workflow";
export type CiLiteWorkflowBranchStatus = "missing" | "current" | "stale" | "unmanaged";

export type CiLiteWorkflowBootstrapResult = {
  status: CiLiteWorkflowBootstrapStatus;
  workflowFile: string;
  targetRepo: string;
  targetBranch: string;
  defaultBranch: string | null;
  workflowDefinitionBranch: string | null;
  targetBranchWorkflowStatus: CiLiteWorkflowBranchStatus | "unknown";
  defaultBranchWorkflowStatus: CiLiteWorkflowBranchStatus | "unknown";
  hasWorkflowDispatch: boolean;
  hasRequiredInputs: boolean;
  githubIndexMayLag: boolean;
  recommendedWaitSeconds: number;
  warning?: string;
};

function normalizeContent(content: string): string { return String(content ?? "").replace(/\r\n/g, "\n").trim(); }
const isManagedCiLiteWorkflow = (c: string) => c.includes("# managed-by: k1w1") && c.includes("# workflow-version:");
const hasWorkflowDispatch = (c: string) => normalizeContent(c).includes("workflow_dispatch:");
const hasRequiredDispatchInputs = (c: string) => { const n = normalizeContent(c); return hasWorkflowDispatch(n) && n.includes("job_id:") && n.includes("ref:"); };
const tokenless = (m: string) => /github token fehlt|missing github token|requires github token/i.test(m);
const autherr = (m: string) => /401|403|unauthorized|forbidden|bad credentials/i.test(m);

async function readStatus(owner:string,repo:string,branch:string,path:string,tpl:string): Promise<{status: CiLiteWorkflowBranchStatus; content: string}>{
  try {
    const c=await getRepoFileText({owner,repo,path,ref:branch});
    const n=normalizeContent(c);
    if(!n) return {status:"missing", content:""};
    if(!isManagedCiLiteWorkflow(n)) return {status:"unmanaged",content:n};
    return {status: n===tpl?"current":"stale", content:n};
  } catch(e){
    const m=e instanceof Error?e.message:String(e);
    if(m.includes("404")||/not found/i.test(m)) return {status:"missing",content:""};
    throw e;
  }
}

export async function ensureCiLiteWorkflowBootstrap(params:{owner:string;repo:string;branch:string;workflowFile:string;}): Promise<CiLiteWorkflowBootstrapResult> {
  const {owner,repo,branch:targetBranch,workflowFile}=params;
  const targetRepo=`${owner}/${repo}`;
  const template=WORKFLOW_TEMPLATES[workflowFile];
  const base={workflowFile,targetRepo,targetBranch,defaultBranch:null,workflowDefinitionBranch:null,targetBranchWorkflowStatus:"unknown" as const,defaultBranchWorkflowStatus:"unknown" as const,hasWorkflowDispatch:false,hasRequiredInputs:false,githubIndexMayLag:false,recommendedWaitSeconds:60};
  if(!template) return {status:"skipped_unknown_workflow",...base,warning:`CI-Lite bootstrap skipped: unmanaged workflow '${workflowFile}'.`};
  const path=`.github/workflows/${workflowFile}`; const tpl=normalizeContent(template);
  try { await getBranchHeadSha(owner,repo,targetBranch); } catch(e){ const m=e instanceof Error?e.message:String(e); if(tokenless(m)||autherr(m)) return {status:"skipped_tokenless",...base,warning:"CI-Lite bootstrap skipped locally (GitHub auth unavailable/invalid). Dispatch continues via Edge path."}; throw new Error(`CI-Lite target branch '${targetBranch}' does not exist or is not readable.`); }
  let defaultBranch:string;
  try { defaultBranch=await getDefaultBranch(owner,repo); } catch(e){ const m=e instanceof Error?e.message:String(e); if(tokenless(m)||autherr(m)) return {status:"skipped_tokenless",...base,warning:"CI-Lite bootstrap skipped locally (GitHub auth unavailable/invalid). Dispatch continues via Edge path."}; throw e; }
  const definitionBranch=defaultBranch;
  const defRead=await readStatus(owner,repo,definitionBranch,path,tpl);
  const targetRead=targetBranch===definitionBranch?defRead:await readStatus(owner,repo,targetBranch,path,tpl);
  const diag: Omit<CiLiteWorkflowBootstrapResult, "status" | "warning"> = {...base,defaultBranch,workflowDefinitionBranch:definitionBranch,targetBranchWorkflowStatus:targetRead.status,defaultBranchWorkflowStatus:defRead.status,hasWorkflowDispatch:hasWorkflowDispatch(defRead.content),hasRequiredInputs:hasRequiredDispatchInputs(defRead.content)};
  if(defRead.status==="unmanaged") throw new Error(`CI-Lite Workflow '${workflowFile}' exists on definition branch '${definitionBranch}' but is unmanaged. Auto-repair aborted.`);
  if(targetRead.status==="unmanaged") throw new Error(`CI-Lite Workflow '${workflowFile}' exists on target branch '${targetBranch}' but is unmanaged. Auto-repair aborted.`);
  let status:CiLiteWorkflowBootstrapStatus="current";
  if(defRead.status!=="current" || !hasRequiredDispatchInputs(defRead.content)) { await createOrUpdateFile(owner,repo,path,`${template}`.replace(/\r\n/g,"\n"),defRead.status==="missing"?`chore(ci-lite): bootstrap ${workflowFile}`:`fix(ci-lite): repair ${workflowFile}`,definitionBranch); status=defRead.status==="missing"?"created":"repaired"; }
  const targetNeeds=targetBranch!==definitionBranch && (targetRead.status==="missing"||targetRead.status==="stale"||!hasRequiredDispatchInputs(targetRead.content));
  if(targetNeeds){ await createOrUpdateFile(owner,repo,path,`${template}`.replace(/\r\n/g,"\n"),targetRead.status==="missing"?`chore(ci-lite): bootstrap ${workflowFile}`:`fix(ci-lite): repair ${workflowFile}`,targetBranch); status=status==="current"?(targetRead.status==="missing"?"created":"repaired"):status; }
  const changed=status!=="current";
  return {...diag,status,githubIndexMayLag:changed,recommendedWaitSeconds:changed?60:0};
}
