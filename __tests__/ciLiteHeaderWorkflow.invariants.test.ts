import { asAnySnippet } from "./helpers/invariantSnippetHelpers";
import { readRepoText as read } from "./helpers/repoSourceHelpers";

describe("CI Lite Header workflow invariants", () => {
  it("guards dispatch against double-tap while a dispatch is in-flight", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const runLookupStateSrc = read("components/CiLiteHeaderButton/hooks/useCiLiteRunLookupState.ts");

    expect(src).toContain("if (dispatching) return;");
    expect(runLookupStateSrc).toContain("const [locatingRun, setLocatingRun] = useState(false);");
  });

  it("keeps busy/tracking/header-running active while run lookup is still in progress", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const statusHelper = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflowStatusHelpers.ts");

    expect(src).toContain("const hasActiveRunContext = dispatching || locatingRun || chainWaiting || trackedRunId != null;");
    expect(src).toContain("const isTrackingRun = dispatching || locatingRun || chainWaiting || (trackedRunId != null && !runCompleted);");
    expect(src).toContain("dispatching ||\n    locatingRun ||\n    chainWaiting ||");
    expect(src).toContain("deriveCiLiteHeaderState({");
    expect(statusHelper).toContain("if (dispatching || locatingRun || chainWaiting) {");
    expect(statusHelper).toContain('return "running";');
  });

  it("resets run lookup state on found run, timeout, and fatal lookup error without reusing stale intervals", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const runLookupStateSrc = read("components/CiLiteHeaderButton/hooks/useCiLiteRunLookupState.ts");

    expect(runLookupStateSrc).toContain("const stopRunLookup = useCallback(() => {");
    expect(runLookupStateSrc).toContain("setLocatingRun(false);");
    expect(src).toContain("const lookupFinished = await poll();");
    expect(src).toContain("if (!lookupFinished) {");
    expect(runLookupStateSrc).toContain("const scheduleLookupPoll = useCallback((params: {");
    expect(runLookupStateSrc).toContain("lookupGenerationRef.current += 1;");
    expect(runLookupStateSrc).toContain("if (!isLookupGenerationActive(params.generation)) return;");
    expect(runLookupStateSrc).toContain("pollTimerRef.current = setTimeout(() => {");
  });

  it("keeps a run-context artifact attempt guard to avoid endless fetch loops on completed failures", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain("const artifactAttemptedContextRef = useRef<string | null>(null);");
    expect(src).toContain("if (artifactAttemptedContextRef.current === artifactContextKey) return;");
    expect(src).toContain("artifactAttemptedContextRef.current = artifactContextKey;");
  });

  it("persists CI-Lite outcome only for the active CI-Lite run context", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain("if (runId == null || workflowRun.id !== runId) return;");
    expect(src).toContain("if (!githubRepo || !targetRef || targetRef.trim() !== branch.trim()) return;");
  });

  it("uses typed head_sha fallback from WorkflowRun instead of any-cast", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const workflowType = read("shared/types/workflowRun.ts");

    expect(src).toContain("workflowRun?.head_sha");
    expect(src).not.toContain(`(${asAnySnippet("workflowRun")})?.head_sha`);
    expect(workflowType).toContain("head_sha?: string;");
  });

  it("keeps CI-Lite chain coupling explicit while requiring the shared job_id marker", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain("sourceHeadSha: workflowRun.head_sha ?? null");
    expect(src).toContain("requireJobIdMarker: true");
    expect(src).toContain("requires the explicit job_id marker for both manual and chained CI-Lite runs");
    expect(src).toContain("sourceHeadSha remains a secondary freshness/safety guard");
    expect(src).toContain('buildLookupFailureMessage({ workflowLabel: "Autofix-Chain → CI Lite" })');
    expect(src).toContain("manual workflow_dispatch lookups may use a guarded fallback");
  });

  it("requires workflow event + branch to match before binding a located run", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const matchingSrc = read("components/CiLiteHeaderButton/hooks/workflowRunMatching.ts");

    expect(src).toContain('const workflowLookupNote = typeof json?.note === "string" ? json.note.trim() : "";');
    expect(src).toContain("Workflow-Run-Lookup ist nicht workflow-spezifisch abgesichert");
    expect(matchingSrc).toContain('if (event && event !== opts.expectedEvent) return false;');
    expect(matchingSrc).toContain('if (headBranch && headBranch !== targetBranch) return false;');
    expect(src).toContain('expectedEvent: "repository_dispatch"');
    expect(src).toContain('expectedEvent: "workflow_dispatch"');
  });
});
