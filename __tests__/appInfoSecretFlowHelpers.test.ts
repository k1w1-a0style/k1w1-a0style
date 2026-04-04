import {
  createCollectedSecretBackupPayload,
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
});
