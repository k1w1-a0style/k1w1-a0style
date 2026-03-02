import { runBuildPipelineDiagnostics } from "../lib/diagnostics/buildPipelineDiagnostics";
import { applyPatch } from "../lib/diagnostics/patchEngine";
import { runPreflightChecksAll } from "../lib/diagnostics/preflightRunner";
import type { PreflightCheckResult } from "../lib/diagnostics/preflightTypes";
import type { ProjectFile } from "../shared/types/project";
import {
  createPipelineDepsFromProjectFiles,
  loadFixtureFiles,
} from "./helpers/testDeps";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

function checkById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

async function applyFixesFromPreflight(
  files: ProjectFile[],
  results: PreflightCheckResult[],
): Promise<ProjectFile[]> {
  let next = [...files];
  for (const result of results) {
    if (result.fix?.patch) {
      next = await applyPatch(next, result.fix.patch);
    }
  }
  return next;
}

describe("e2e smoke buildflow", () => {
  it("goes from broken fixture to green/yellow-ready diagnostics after autofix", async () => {
    let files = loadFixtureFiles("missing-all-minimum");

    const preflightBefore = runPreflightChecksAll(files, {
      mode: "eas",
      profile: "preview",
    });
    expect(checkById(preflightBefore, "expo-config-validation")?.status).toBe("fail");

    const pipelineBefore = await runBuildPipelineDiagnostics(
      { owner: "o", repo: "r", branch: "main" },
      createPipelineDepsFromProjectFiles(files, {
        secretNames: [],
      }),
    );

    expect(checkById(pipelineBefore.checks, "repo.expoConfig")?.status).toBe("fail");
    expect(checkById(pipelineBefore.checks, "repo.easJson")?.status).toBe("fail");

    files = await applyFixesFromPreflight(files, preflightBefore);

    const pipelineMid = await runBuildPipelineDiagnostics(
      { owner: "o", repo: "r", branch: "main" },
      createPipelineDepsFromProjectFiles(files, {
        secretNames: ["EXPO_TOKEN"],
      }),
    );

    for (const check of pipelineMid.checks) {
      if (check.fix?.patch) {
        files = await applyPatch(files, check.fix.patch);
      }
    }

    files = await applyPatch(files, {
      jsonMerge: [
        {
          path: "app.json",
          patch: { expo: { extra: { eas: { projectId: PROJECT_ID } } } },
          createIfMissing: true,
        },
      ],
    });

    files = await applyPatch(files, {
      upsert: [
        {
          path: ".github/workflows/eas-link.yml",
          content:
            'name: EAS Link\non:\n  workflow_dispatch:\njobs:\n  link:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "link"\n',
        },
        {
          path: ".github/workflows/k1w1-triggered-build.yml",
          content:
            'name: Triggered Build\non:\n  workflow_dispatch:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "build"\n',
        },
      ],
    });

    const preflightAfter = runPreflightChecksAll(files, {
      mode: "eas",
      profile: "preview",
    });
    const pipelineAfter = await runBuildPipelineDiagnostics(
      { owner: "o", repo: "r", branch: "main" },
      createPipelineDepsFromProjectFiles(files, {
        secretNames: ["EXPO_TOKEN"],
      }),
    );

    const appJson = files.find((f) => f.path === "app.json")?.content;
    const easJsonRaw = files.find((f) => f.path === "eas.json")?.content;

    expect(appJson).toBeTruthy();
    expect(easJsonRaw).toBeTruthy();

    const easJson = JSON.parse(easJsonRaw ?? "{}");
    expect(easJson.build?.development).toBeTruthy();
    expect(easJson.build?.preview).toBeTruthy();
    expect(easJson.build?.production).toBeTruthy();
    expect(easJson.build?.development?.android?.buildType).toBe("apk");
    expect(easJson.build?.preview?.android?.buildType).toBe("apk");
    expect(easJson.build?.production?.android?.withoutCredentials).not.toBe(true);

    const gateFails = pipelineAfter.checks.filter((c) => c.status === "fail");
    expect(gateFails).toHaveLength(0);

    const diagnosticLastOkSimulated = gateFails.length === 0;
    expect(diagnosticLastOkSimulated).toBe(true);

    expect(checkById(preflightAfter, "expo-config-validation")?.status).toBe("pass");
    expect(checkById(pipelineAfter.checks, "repo.easProjectId")?.status).toBe("pass");
  });

  it("fixes missing build.preview profile via additive jsonMerge autofix", async () => {
    let files = loadFixtureFiles("missing-easProfiles");

    const pipelineBefore = await runBuildPipelineDiagnostics(
      { owner: "o", repo: "r", branch: "main" },
      createPipelineDepsFromProjectFiles(files, { secretNames: ["EXPO_TOKEN"] }),
    );

    const missingPreview = checkById(pipelineBefore.checks, "repo.easProfile.preview");
    expect(missingPreview?.status).toBe("fail");
    expect(missingPreview?.fix?.patch?.jsonMerge?.[0]?.path).toBe("eas.json");

    if (missingPreview?.fix?.patch) {
      files = await applyPatch(files, missingPreview.fix.patch);
    }

    const pipelineAfter = await runBuildPipelineDiagnostics(
      { owner: "o", repo: "r", branch: "main" },
      createPipelineDepsFromProjectFiles(files, { secretNames: ["EXPO_TOKEN"] }),
    );
    expect(checkById(pipelineAfter.checks, "repo.easProfile.preview")).toBeUndefined();
    expect(checkById(pipelineAfter.checks, "repo.easBuildType.preview")?.status).toBe("pass");
  });

  it("fixes workflow name colon quoting from fixture", async () => {
    let files = loadFixtureFiles("workflow-colon-quoting");

    const preflightBefore = runPreflightChecksAll(files, {
      mode: "eas",
      profile: "preview",
    });

    const quotingCheck = checkById(preflightBefore, "workflow-yaml-name-colon-quoting");
    expect(quotingCheck?.status).toBe("fail");

    if (quotingCheck?.fix?.patch) {
      files = await applyPatch(files, quotingCheck.fix.patch);
    }

    const updatedWorkflow = files.find((f) => f.path === ".github/workflows/eas-build.yml")?.content;
    expect(updatedWorkflow).toContain('name: "Foo: Bar"');
  });

  it("reports EXPO_TOKEN secret fail when pipeline secrets are missing", async () => {
    const files = loadFixtureFiles("secrets-missing");

    const result = await runBuildPipelineDiagnostics(
      { owner: "o", repo: "r", branch: "main" },
      createPipelineDepsFromProjectFiles(files, { secretNames: [] }),
    );

    expect(checkById(result.checks, "repo.secret.expoToken")?.status).toBe("fail");
  });
});
