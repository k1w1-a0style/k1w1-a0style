import {
  createCollectedSecretBackupPayload,
  hydrateGitHubSelectionFromBackup,
  persistAppliedSecretTokens,
  readAppliedSecretTokens,
} from "../screens/AppInfoScreen/hooks/appInfoSecretFlowHelpers";

describe("appInfoSecretFlowHelpers", () => {
  test("createCollectedSecretBackupPayload keeps workflow->legacy mapping", () => {
    const payload = createCollectedSecretBackupPayload({
      connections: {
        supabaseRaw: "raw",
        supabaseUrl: "url",
        supabaseAnonKey: "anon",
        easProjectId: "eas",
      },
      tokens: {
        githubToken: "gh",
        expoToken: "ex",
        workflowAdminKey: "workflow",
        androidKeystoreExportAdminKey: "keystore",
        signingAdminKey: "sign-admin",
        signingMasterKey: "sign-master",
      },
      github: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        recentRepos: ["owner/repo"],
      },
    });

    expect(payload.tokens.workflowAdminKey).toBe("workflow");
    expect(payload.tokens.legacyEdgeAdminKey).toBeNull();
    expect(payload.github.linkedRepo).toBe("owner/repo");
  });

  test("readAppliedSecretTokens preserves precedence and trimming", () => {
    const payload = createCollectedSecretBackupPayload({
      connections: {
        supabaseRaw: "raw",
        supabaseUrl: "url",
        supabaseAnonKey: "anon",
        easProjectId: "eas",
      },
      tokens: {
        githubToken: "  gh-local  ",
        expoToken: null,
        workflowAdminKey: null,
        androidKeystoreExportAdminKey: "  ",
        signingAdminKey: null,
        signingMasterKey: " master-local ",
      },
      github: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        recentRepos: ["owner/repo"],
      },
    });

    const withCiFallback = {
      ...payload,
      ciSecrets: {
        ...payload.ciSecrets,
        EXPO_TOKEN: " expo-ci ",
        K1W1_EDGE_WORKFLOW_ADMIN_KEY: "workflow-ci",
        K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY: "keystore-ci",
        SIGNING_ADMIN_KEY: "sign-admin-ci",
      },
    };

    expect(readAppliedSecretTokens(withCiFallback)).toEqual({
      githubToken: "gh-local",
      expoToken: "expo-ci",
      workflowAdminKey: "workflow-ci",
      androidKeystoreExportAdminKey: "keystore-ci",
      signingAdminKey: "sign-admin-ci",
      signingMaster: "master-local",
    });
  });


  test("persistAppliedSecretTokens applies save/delete fail-closed semantics", async () => {
    const calls: string[] = [];
    const mk = (name: string) => async (value: string) => {
      calls.push(`${name}:${value}`);
    };
    const clr = (name: string) => async () => {
      calls.push(`${name}:delete`);
    };

    await persistAppliedSecretTokens(
      {
        githubToken: "gh",
        expoToken: "",
        workflowAdminKey: "workflow",
        androidKeystoreExportAdminKey: "",
        signingAdminKey: "sign-admin",
        signingMaster: "",
      },
      {
        saveGitHubToken: mk("github"),
        deleteGitHubToken: clr("github"),
        saveExpoToken: mk("expo"),
        deleteExpoToken: clr("expo"),
        saveWorkflowAdminKey: mk("workflow"),
        deleteWorkflowAdminKey: clr("workflow"),
        saveAndroidKeystoreExportAdminKey: mk("keystore"),
        deleteAndroidKeystoreExportAdminKey: clr("keystore"),
        saveSigningAdminKey: mk("signAdmin"),
        deleteSigningAdminKey: clr("signAdmin"),
        saveSigningMasterKey: mk("signMaster"),
        deleteSigningMasterKey: clr("signMaster"),
      },
    );

    expect(calls).toEqual([
      "github:gh",
      "expo:delete",
      "workflow:workflow",
      "keystore:delete",
      "signAdmin:sign-admin",
      "signMaster:delete",
    ]);
  });

  test("hydrateGitHubSelectionFromBackup replays repo history in reverse order and sets active pair", async () => {
    const events: string[] = [];

    await hydrateGitHubSelectionFromBackup(
      {
        linkedRepo: "owner/main",
        linkedBranch: "main",
        recentRepos: ["owner/one", "owner/two", "owner/two"],
      },
      {
        clearRecentRepos: async () => {
          events.push("clear");
        },
        addRecentRepo: (repo) => {
          if (repo === "owner/two") {
            if (events.includes("add:owner/two")) throw new Error("duplicate");
          }
          events.push(`add:${repo}`);
        },
        setLinkedRepo: (repo, branch) => {
          events.push(`set:${repo}:${branch}`);
        },
      },
    );

    expect(events).toEqual([
      "clear",
      "add:owner/two",
      "add:owner/one",
      "set:owner/main:main",
    ]);
  });

});
