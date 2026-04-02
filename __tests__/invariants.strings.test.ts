import fs from "fs";
import path from "path";
import { REQUIRED_SECRETS } from "../lib/diagnostics/ciAutoFix";
import { AUTO_FIX_MANAGED_WORKFLOW_FILES } from "../lib/diagnostics/managedWorkflowRegistry";
import { STORAGE_KEYS } from "../lib/storageKeys";
import {
  WORKFLOW_EAS_BUILD,
  WORKFLOW_EAS_LINK,
  WORKFLOW_K1W1_TRIGGERED_BUILD,
  WORKFLOW_RELEASE_BUILD,
} from "../lib/diagnostics/workflowTemplates";
import { minimalDefaultFor } from "../lib/diagnostics/templates/defaults";
import { patchEasJson } from "../lib/diagnostics/templates/patchers/easJson";

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("Invariant String Tests", () => {
  it("I1 — Required secret names stay exact (EXPO_TOKEN)", () => {
    // Why it matters: even tiny typos silently break CI secret detection.
    expect(REQUIRED_SECRETS).toContain("EXPO_TOKEN");
    expect(REQUIRED_SECRETS).not.toContain("EXPO TOKEN");
    expect(REQUIRED_SECRETS).not.toContain("EXPO-TOKEN");
  });

  it("I2 — Supabase secret names stay exact in canonical workflow templates", () => {
    // Why it matters: renamed secrets break production credential export in Actions.
    const templates = [
      WORKFLOW_K1W1_TRIGGERED_BUILD,
      WORKFLOW_EAS_BUILD,
      WORKFLOW_RELEASE_BUILD,
      WORKFLOW_EAS_LINK,
    ].join("\n");

    expect(templates).toContain("SUPABASE_URL");
    expect(templates).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("I3 — Storage keys stay canonical for critical readiness/signing state", () => {
    // Why it matters: key drift causes false negatives in diagnostics and build gates.
    expect(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).toBe("diagnostic_last_ok");
    expect(STORAGE_KEYS.CONN_REPO_BRANCH).toBe("conn_repo_branch");
    expect(STORAGE_KEYS.CONN_REPO_SLUG).toBe("conn_repo_slug");
    expect(STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION).toBe("cred_key_exists_production");
  });

  it("I4 — Build profile names are canonical (development/preview/production only)", () => {
    // Why it matters: profile aliases (dev/prod) can trigger wrong workflow behavior.
    const typesSource = read("screens/EnhancedBuildScreen/types.ts");
    expect(typesSource).toContain('export type BuildProfile = "development" | "preview" | "production";');
    expect(typesSource).not.toContain('"dev"');
    expect(typesSource).not.toContain('"prod"');
  });

  it("I5 — Workflow filenames remain canonical (no case or naming drift)", () => {
    // Why it matters: wrong filename strings break dispatch/startBuild integration.
    expect(AUTO_FIX_MANAGED_WORKFLOW_FILES).toEqual([
      "k1w1-triggered-build.yml",
      "eas-build.yml",
      "release-build.yml",
      "eas-link.yml",
      "k1w1-ci-lite.yml",
      "k1w1-ci-lite-autofix.yml",
    ]);

    expect(AUTO_FIX_MANAGED_WORKFLOW_FILES).not.toContain("K1W1-triggered-build.yml");
    expect(AUTO_FIX_MANAGED_WORKFLOW_FILES).not.toContain("EAS-link.yml");
  });

  it("I6 — APK-only policy stays pinned to buildType=apk in defaults/patch path", () => {
    // Why it matters: accidental app-bundle defaults change deliverables and signing flow.
    const defaultEasJson = minimalDefaultFor("eas.json");
    expect(defaultEasJson).toContain('"buildType": "apk"');
    expect(defaultEasJson).not.toContain('"buildType": "app-bundle"');

    const patched = patchEasJson("{}").next;
    expect(patched).toContain('"buildType": "apk"');
    expect(patched).not.toContain('"buildType": "app-bundle"');
  });

  it("I7 — No silent branch fallback: explicit branch-missing block message exists", () => {
    // Why it matters: silently normalizing branch to main can ship from wrong ref.
    const buildHook = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");
    expect(buildHook).toContain("Branch fehlt (im GitHub-Repos-Screen auswaehlen)");
    expect(buildHook).not.toMatch(/\|\|\s*["']main["']/);
  });

  it("I8 — No silent repo fallback: explicit repo-missing block message exists", () => {
    // Why it matters: hidden repo defaults can dispatch builds to the wrong repository.
    const buildHook = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");
    expect(buildHook).toContain("Repo fehlt (im GitHub-Repos-Screen verknuepfen)");
    expect(buildHook).not.toMatch(/repo\s*\|\|\s*["'][^"']+\/[^"]+["']/i);
  });

  it("I9 — Workflow templates use secret placeholder, not hardcoded service-role literals", () => {
    // Why it matters: service role leakage in workflow templates is a severe security incident.
    const templates = [
      WORKFLOW_K1W1_TRIGGERED_BUILD,
      WORKFLOW_EAS_BUILD,
      WORKFLOW_RELEASE_BUILD,
      WORKFLOW_EAS_LINK,
    ].join("\n");

    expect(templates).toContain("${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}");

    const serviceRoleLines = templates
      .split("\n")
      .filter((line) => line.includes("SERVICE_ROLE"));

    for (const line of serviceRoleLines) {
      // allow GitHub Actions secret placeholders, but block literal-looking values
      expect(line).not.toMatch(/SERVICE_ROLE[^\n]*[:=]\s*["']?[A-Za-z0-9+\/_=-]{40,}/);
    }
  });

  it("I10 — Patchlog keeps both references for patch 337", () => {
    // Why it matters: dual refs prevent losing context between compact patch + notes file.
    const patchLog = read("docs/patches/PATCHLOG_ROOT.md");
    expect(patchLog).toContain("patch_337.md");
    expect(patchLog).toContain("PATCH_337_NOTES.md");
  });
  test("I11 — CI-lite workflows and templates remain multiline (no flattening)", () => {
    // Why it matters: flattened YAML breaks GitHub parsing and can be reintroduced by bootstrap templates.
    const wf = read(".github/workflows/k1w1-ci-lite.yml");
    const wfAuto = read(".github/workflows/k1w1-ci-lite-autofix.yml");

    // Workflows must clearly be multiline YAML.
    expect(wf.split(/\r?\n/).length).toBeGreaterThan(80);
    expect(wf).toContain("\non:");
    expect(wf).toContain("\n  repository_dispatch:");
    expect(wf).toContain("trigger-ci-lite");
    expect(wf).toContain("\n  workflow_dispatch:");
    expect(wf).toContain("workflow_ref");
    expect(wf).toContain("source_workflow");
    expect(wf).toContain("\njobs:\n");

    expect(wfAuto.split(/\r?\n/).length).toBeGreaterThan(120);
    expect(wfAuto).toContain("\non:");
    expect(wfAuto).toContain("\n  workflow_dispatch:");
    expect(wfAuto).toContain("repos/${GITHUB_REPOSITORY}/dispatches");
    expect(wfAuto).toContain('event_type="trigger-ci-lite"');
    expect(wfAuto).toContain("\njobs:\n");

    const sharedTemplates = read("shared/workflows/managedWorkflowTemplates.ts");
    expect(sharedTemplates).toContain("k1w1-ci-lite.yml");
    expect(sharedTemplates).toContain("\non:\n  repository_dispatch:");
    expect(sharedTemplates).toContain("trigger-ci-lite");
    expect(sharedTemplates).toContain("repos/\\${GITHUB_REPOSITORY}/dispatches");

    const edge = read("supabase/functions/github-workflow-dispatch/index.ts");
    expect(edge).toContain("missing_workflow");
    expect(edge).toContain("Dispatch is mutation-free");
    expect(edge).not.toContain("WORKFLOW_TEMPLATES");
    expect(edge).not.toContain("managedWorkflowTemplates");

    const appTemplates = read("infra/github/workflowTemplates.ts");
    expect(appTemplates).toContain("WORKFLOW_TEMPLATES");
    expect(appTemplates).toContain("managedWorkflowTemplates");
  });
  it("I12 — CI-lite workflows keep pipefail, pinned actions, and Expo preflight", () => {
    // Why it matters: tee without pipefail causes false-green header status, and Expo preflight guards build-readiness.
    const wf = read(".github/workflows/k1w1-ci-lite.yml");
    const wfAuto = read(".github/workflows/k1w1-ci-lite-autofix.yml");
    const sharedTemplates = read("shared/workflows/managedWorkflowTemplates.ts");
    const appTemplates = read("infra/github/workflowTemplates.ts");

    for (const source of [wf, wfAuto, sharedTemplates]) {
      expect(source).toContain("set -o pipefail");
      expect(source).toContain("(data?.expo ?? data)?.extra?.eas?.projectId");
      expect(source).toContain("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5");
      expect(source).toContain("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020");
      expect(source).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
      expect(source).toContain('"expo_exit":');
      expect(source).toContain('"ok":');
    }
    expect(appTemplates).toContain("WORKFLOW_TEMPLATES");
    expect(appTemplates).toContain("managedWorkflowTemplates");
  });

});
