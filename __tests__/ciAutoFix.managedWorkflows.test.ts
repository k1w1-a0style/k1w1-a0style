import { WORKFLOW_TEMPLATES } from "../infra/github/workflowTemplates";
import {
  AUTO_FIX_MANAGED_WORKFLOW_FILES,
  classifyManagedWorkflowState,
  getAutoFixManagedWorkflowDefinitions,
} from "../lib/diagnostics/managedWorkflowRegistry";
import {
  WORKFLOW_EAS_BUILD,
  WORKFLOW_EAS_LINK,
  WORKFLOW_K1W1_TRIGGERED_BUILD,
  WORKFLOW_RELEASE_BUILD,
} from "../lib/diagnostics/workflowTemplates";

const mockCreateOrUpdateFile = jest.fn(async () => undefined);
const mockGetRepoFileText = jest.fn();
const mockListRepoSecretNames = jest.fn(async () => []);

jest.mock("../infra/github/githubService", () => ({
  createOrUpdateFile: (...args: any[]) => (mockCreateOrUpdateFile as any)(...args),
  getRepoFileText: (...args: any[]) => (mockGetRepoFileText as any)(...args),
  listRepoSecretNames: (...args: any[]) => (mockListRepoSecretNames as any)(...args),
}));

import { autoFixCIWorkflows } from "../lib/diagnostics/ciAutoFix";

const GITIGNORE_MARKER = "# --- k1w1 apk-builder: ignore patch zips ---";
const CURRENT_GITIGNORE = `${GITIGNORE_MARKER}\nk1w1-*.zip\n`;
const EXPECTED_REGISTRY_CONTENT: Record<string, string> = {
  "k1w1-triggered-build.yml": WORKFLOW_K1W1_TRIGGERED_BUILD,
  "eas-build.yml": WORKFLOW_EAS_BUILD,
  "release-build.yml": WORKFLOW_RELEASE_BUILD,
  "eas-link.yml": WORKFLOW_EAS_LINK,
  "k1w1-ci-lite.yml": WORKFLOW_TEMPLATES["k1w1-ci-lite.yml"],
  "k1w1-ci-lite-autofix.yml": WORKFLOW_TEMPLATES["k1w1-ci-lite-autofix.yml"],
};

const currentTemplateFor = (path: string): string => {
  if (path === ".gitignore") return CURRENT_GITIGNORE;
  const fileName = path.split("/").pop() ?? "";
  return EXPECTED_REGISTRY_CONTENT[fileName] ?? "";
};

const installRepoFileTextMock = (overrides: Record<string, string | Error>) => {
  mockGetRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
    const override = overrides[path];
    if (override instanceof Error) throw override;
    if (typeof override === "string") return override;
    return currentTemplateFor(path);
  });
};

describe("ciAutoFix managed workflows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installRepoFileTextMock({});
  });

  it("covers existing build/EAS workflows and CI Lite workflows from one registry", () => {
    const defs = getAutoFixManagedWorkflowDefinitions();

    expect(AUTO_FIX_MANAGED_WORKFLOW_FILES).toEqual([
      "k1w1-triggered-build.yml",
      "eas-build.yml",
      "release-build.yml",
      "eas-link.yml",
      "k1w1-ci-lite.yml",
      "k1w1-ci-lite-autofix.yml",
    ]);

    expect(defs.map((entry) => entry.fileName)).toEqual(AUTO_FIX_MANAGED_WORKFLOW_FILES);
    expect(defs.every((entry) => entry.content === EXPECTED_REGISTRY_CONTENT[entry.fileName])).toBe(true);
  });

  it("classifies an outdated CI Lite workflow as drifted", async () => {
    const staleCiLite = [
      "name: K1W1 CI Lite (legacy)",
      "on:",
      "  repository_dispatch:",
      "    types: [trigger-ci-lite]",
      "jobs:",
      "  checks:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      '      - run: echo "legacy ci lite without run-name or job_id contract"',
      "",
    ].join("\n");

    installRepoFileTextMock({
      ".github/workflows/k1w1-ci-lite.yml": staleCiLite,
    });

    const changes = await autoFixCIWorkflows({
      owner: "k1w1-a0style",
      repo: "musik-player",
      branch: "main",
    });

    const ciLite = changes.find((entry) => entry.path === ".github/workflows/k1w1-ci-lite.yml");
    expect(ciLite).toMatchObject({
      detectedState: "drifted",
      applyState: "updated",
      changed: true,
    });
    expect(ciLite?.message).toMatch(/drift repaired/i);
  });

  it("updates a drifted CI Lite workflow with the managed template", async () => {
    installRepoFileTextMock({
      ".github/workflows/k1w1-ci-lite.yml": "name: old ci lite\n",
      ".github/workflows/k1w1-ci-lite-autofix.yml": new Error("404 not found"),
    });

    const changes = await autoFixCIWorkflows({
      owner: "k1w1-a0style",
      repo: "musik-player",
      branch: "main",
    });

    expect(mockCreateOrUpdateFile).toHaveBeenCalledWith(
      "k1w1-a0style",
      "musik-player",
      ".github/workflows/k1w1-ci-lite.yml",
      EXPECTED_REGISTRY_CONTENT["k1w1-ci-lite.yml"],
      "fix(ci): update k1w1-ci-lite.yml",
      "main",
    );
    expect(mockCreateOrUpdateFile).toHaveBeenCalledWith(
      "k1w1-a0style",
      "musik-player",
      ".github/workflows/k1w1-ci-lite-autofix.yml",
      EXPECTED_REGISTRY_CONTENT["k1w1-ci-lite-autofix.yml"],
      "fix(ci): update k1w1-ci-lite-autofix.yml",
      "main",
    );

    const autofix = changes.find(
      (entry) => entry.path === ".github/workflows/k1w1-ci-lite-autofix.yml",
    );
    expect(autofix).toMatchObject({
      detectedState: "missing",
      applyState: "updated",
      changed: true,
    });
  });

  it("leaves the current CI Lite workflow untouched", async () => {
    installRepoFileTextMock({
      ".github/workflows/k1w1-ci-lite.yml": EXPECTED_REGISTRY_CONTENT["k1w1-ci-lite.yml"],
      ".github/workflows/k1w1-ci-lite-autofix.yml": EXPECTED_REGISTRY_CONTENT["k1w1-ci-lite-autofix.yml"],
      ".gitignore": CURRENT_GITIGNORE,
    });

    const changes = await autoFixCIWorkflows({
      owner: "k1w1-a0style",
      repo: "musik-player",
      branch: "main",
    });

    const ciLite = changes.find((entry) => entry.path === ".github/workflows/k1w1-ci-lite.yml");
    const ciLiteAutofix = changes.find(
      (entry) => entry.path === ".github/workflows/k1w1-ci-lite-autofix.yml",
    );

    expect(ciLite).toMatchObject({
      detectedState: "current",
      applyState: "unchanged",
      changed: false,
    });
    expect(ciLiteAutofix).toMatchObject({
      detectedState: "current",
      applyState: "unchanged",
      changed: false,
    });
    expect(mockCreateOrUpdateFile).not.toHaveBeenCalledWith(
      "k1w1-a0style",
      "musik-player",
      ".github/workflows/k1w1-ci-lite.yml",
      expect.any(String),
      expect.any(String),
      "main",
    );
  });

  it("exposes current/missing/drifted classification for reporting", () => {
    expect(
      classifyManagedWorkflowState({
        currentContent: "",
        desiredContent: EXPECTED_REGISTRY_CONTENT["k1w1-ci-lite.yml"],
      }),
    ).toBe("missing");

    expect(
      classifyManagedWorkflowState({
        currentContent: "name: legacy ci lite\n",
        desiredContent: EXPECTED_REGISTRY_CONTENT["k1w1-ci-lite.yml"],
      }),
    ).toBe("drifted");

    expect(
      classifyManagedWorkflowState({
        currentContent: EXPECTED_REGISTRY_CONTENT["k1w1-ci-lite.yml"],
        desiredContent: EXPECTED_REGISTRY_CONTENT["k1w1-ci-lite.yml"],
      }),
    ).toBe("current");
  });
});
