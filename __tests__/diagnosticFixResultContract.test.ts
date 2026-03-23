import {
  getDiagnosticFixExecutionResult,
  getDiagnosticFixOffer,
} from "../lib/diagnostics/fixResultContract";

describe("diagnostic fix result contract", () => {
  test("distinguishes advisory, patch applied, workflow dispatched, blocked and failed states", () => {
    const advisory = getDiagnosticFixOffer({ status: "warn" } as any);
    const patchApplied = getDiagnosticFixExecutionResult({ status: "patch_applied" });
    const workflowDispatched = getDiagnosticFixExecutionResult({ status: "workflow_dispatched" });
    const blocked = getDiagnosticFixExecutionResult({ status: "blocked", detail: "guard" });
    const failed = getDiagnosticFixExecutionResult({ status: "failed", detail: "boom" });

    expect(advisory.status).toBe("advisory_only");
    expect(patchApplied.status).toBe("patch_applied");
    expect(workflowDispatched.status).toBe("workflow_dispatched");
    expect(blocked.status).toBe("blocked");
    expect(failed.status).toBe("failed");
    expect(workflowDispatched.requiresRecheck).toBe(true);
    expect(patchApplied.localChangeApplied).toBe(true);
  });

  test("returns honest offer/badge/action texts for patch, workflow-only and advisory fixes", () => {
    const patchOffer = getDiagnosticFixOffer({
      status: "fail",
      fix: { patch: { upsert: [{ path: "app.json", content: "{}" }] } },
    } as any);
    const workflowOffer = getDiagnosticFixOffer({
      status: "fail",
      fix: { workflowDispatch: { workflowFileName: "eas-link.yml" } },
    } as any);
    const advisory = getDiagnosticFixOffer({ status: "warn" } as any);

    expect(patchOffer.badgeText).toBe("Patch-Fix verfügbar");
    expect(patchOffer.actionLabel).toBe("Patch-Fix anwenden");
    expect(patchOffer.previewAvailable).toBe(true);

    expect(workflowOffer.badgeText).toBe("Workflow-Fix verfügbar");
    expect(workflowOffer.actionLabel).toBe("Workflow-Fix starten");
    expect(workflowOffer.previewAvailable).toBe(false);

    expect(advisory.badgeText).toBe("Im Chat verfügbar");
    expect(advisory.summary).toContain("Chat");
  });
});
