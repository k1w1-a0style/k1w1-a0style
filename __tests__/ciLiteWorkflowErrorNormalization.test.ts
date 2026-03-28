import {
  buildCiLiteLookupFailureMessage,
  normalizeCiLiteWorkflowError,
} from "../components/CiLiteHeaderButton/hooks/ciLiteWorkflowErrors";

describe("CI Lite workflow error normalization", () => {
  it("classifies missing GitHub token explicitly instead of as generic HTTP 500", () => {
    const normalized = normalizeCiLiteWorkflowError({
      context: "dispatch",
      statusCode: 500,
      payload: {
        ok: false,
        error: "Missing GitHub token",
        expected: ["GITHUB_TOKEN", "GH_TOKEN"],
      },
    });

    expect(normalized.code).toBe("missing_github_token");
    expect(normalized.userMessage).toMatch(/GitHub-Token fehlt/i);
    expect(normalized.userMessage).not.toMatch(/HTTP 500/i);
  });

  it("maps dispatch 404 responses to workflow_not_found", () => {
    const normalized = normalizeCiLiteWorkflowError({
      context: "dispatch",
      statusCode: 404,
      payload: {
        error: "GitHub workflow dispatch failed (workflow not found)",
        details: {
          hint: "Workflow not found in repo. Ensure the workflow file exists under .github/workflows.",
        },
      },
    });

    expect(normalized.code).toBe("workflow_not_found");
    expect(normalized.userMessage).toMatch(/Workflow-Datei\/Workflow .* nicht gefunden/i);
  });

  it("prioritizes local admin-key diagnosis over generic upstream errors", () => {
    const normalized = normalizeCiLiteWorkflowError({
      context: "dispatch",
      adminKey: "edge-admin-key-12345678901234567890",
      statusCode: 401,
      payload: { error: "Unauthorized: missing or invalid admin key" },
    });

    expect(normalized.code).toBe("invalid_or_missing_local_admin_key");
    expect(normalized.userMessage).toMatch(/lokaler (legacy )?workflow admin key(?: \(compat\))? ist lokal vorhanden/i);
    expect(normalized.userMessage).toMatch(/abgelehnt/i);
  });

  it("keeps workflow-run lookup note as structured contract error", () => {
    const normalized = normalizeCiLiteWorkflowError({
      context: "lookup",
      note: "workflowId not found; returned repo-wide workflow runs instead",
    });

    expect(normalized.code).toBe("workflow_lookup_not_scoped");
    expect(normalized.userMessage).toMatch(/nicht workflow-spezifisch abgesichert/i);
  });

  it("falls back to upstream_http_error for generic 5xx responses", () => {
    const normalized = normalizeCiLiteWorkflowError({
      context: "lookup",
      statusCode: 502,
      statusText: "Bad Gateway",
      payload: { error: "GitHub API failed" },
    });

    expect(normalized.code).toBe("upstream_http_error");
    expect(normalized.userMessage).toMatch(/HTTP 502/i);
  });

  it("builds an explicit contract-mismatch lookup message when a plausible run exists", () => {
    const message = buildCiLiteLookupFailureMessage({
      workflowLabel: "Workflow",
      kind: "contract_mismatch",
      hasExistingRunCandidate: true,
    });

    expect(message).toMatch(/plausibler GitHub-Run existiert/i);
    expect(message).toMatch(/Correlation-Contract/i);
    expect(message).not.toMatch(/kein passender Run gefunden/i);
  });

  it("builds an explicit ambiguity lookup message for multiple fresh candidates", () => {
    const message = buildCiLiteLookupFailureMessage({
      workflowLabel: "Workflow",
      kind: "ambiguous",
    });

    expect(message).toMatch(/mehrere frische Kandidaten/i);
    expect(message).toMatch(/keine eindeutige Zuordnung/i);
  });
});
