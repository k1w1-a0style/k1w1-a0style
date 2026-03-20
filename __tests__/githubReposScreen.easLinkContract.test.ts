import {
  checkRepoEasLinkStatus,
  getEasLinkPresentation,
  resolveEasLinkWriteOutcome,
} from "../screens/GitHubReposScreen/utils/easLinkContract";

const EXPECTED_ID = "11111111-1111-1111-1111-111111111111";

describe("GitHubReposScreen EAS link contract", () => {
  it("distinguishes verified, workflow_missing, project_missing, project_invalid, project_mismatch, auth_error and unknown", async () => {
    const verified = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async (path) => {
        if (path === ".github/workflows/eas-link.yml") return "name: eas-link";
        return JSON.stringify({ projectId: EXPECTED_ID });
      },
    });
    expect(verified.state).toBe("verified");

    const workflowMissing = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async (path) => {
        if (path === ".github/workflows/eas-link.yml") throw new Error("File read Fehler (404): missing");
        return JSON.stringify({ projectId: EXPECTED_ID });
      },
    });
    expect(workflowMissing.state).toBe("workflow_missing");

    const projectMissing = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async (path) => {
        if (path === "eas-project.json") throw new Error("File read Fehler (404): missing");
        return "name: eas-link";
      },
    });
    expect(projectMissing.state).toBe("project_missing");

    const projectInvalid = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async (path) => (path === "eas-project.json" ? "{not json" : "name: eas-link"),
    });
    expect(projectInvalid.state).toBe("project_invalid");

    const projectMismatch = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async (path) =>
        path === "eas-project.json"
          ? JSON.stringify({ projectId: "22222222-2222-2222-2222-222222222222" })
          : "name: eas-link",
    });
    expect(projectMismatch.state).toBe("project_mismatch");

    const authError = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async () => {
        throw new Error("File read Fehler (403): forbidden");
      },
    });
    expect(authError.state).toBe("auth_error");

    const unknown = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async () => {
        throw new Error("socket hang up");
      },
    });
    expect(unknown.state).toBe("unknown");
  });

  it("treats a wrong eas-project.json projectId as mismatch instead of verified", async () => {
    const result = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async (path) =>
        path === "eas-project.json"
          ? JSON.stringify({ projectId: "33333333-3333-3333-3333-333333333333" })
          : "name: eas-link",
    });

    expect(result.state).toBe("project_mismatch");
    expect(result.label).toBe("ID mismatch");
  });

  it("does not downgrade auth and permission failures to missing or verified", async () => {
    const result = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async (path) => {
        if (path === ".github/workflows/eas-link.yml") return "name: eas-link";
        throw new Error("401 unauthorized");
      },
    });

    expect(result.state).toBe("auth_error");
    expect(result.label).toBe("Zugriff unklar");
  });

  it("keeps a successful write pending until a green re-check exists", () => {
    const pending = resolveEasLinkWriteOutcome({
      verification: getEasLinkPresentation("unknown", "Recheck blocked by temporary API error."),
    });
    expect(pending.state).toBe("pending_recheck");

    const verified = resolveEasLinkWriteOutcome({
      verification: getEasLinkPresentation("verified"),
    });
    expect(verified.state).toBe("verified");
  });

  it("keeps a fully verified EAS link as clean success", async () => {
    const result = await checkRepoEasLinkStatus({
      expectedProjectId: EXPECTED_ID,
      loadFile: async (path) =>
        path === "eas-project.json" ? JSON.stringify({ projectId: EXPECTED_ID }) : "name: eas-link",
    });

    const writeOutcome = resolveEasLinkWriteOutcome({ verification: result });
    expect(writeOutcome.state).toBe("verified");
    expect(writeOutcome.label).toBe("Verifiziert");
  });
});
