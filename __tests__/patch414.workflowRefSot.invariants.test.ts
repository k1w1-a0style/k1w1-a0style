import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const findRefBlocks = (src: string) => {
  const lines = src.split("\n");
  const blocks: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() !== "ref:") continue;

    const refIndent = line.match(/^\s*/)?.[0].length ?? 0;
    const blockLines = [line];
    let j = i + 1;

    while (j < lines.length) {
      const nextLine = lines[j];
      if (nextLine.trim() === "") {
        blockLines.push(nextLine);
        j += 1;
        continue;
      }

      const nextIndent = nextLine.match(/^\s*/)?.[0].length ?? 0;
      if (nextIndent <= refIndent) break;
      blockLines.push(nextLine);
      j += 1;
    }

    blocks.push(blockLines.join("\n"));
    i = j - 1;
  }

  return blocks;
};

const decodeJsSingleQuoted = (escaped: string) => {
  let out = "";

  for (let i = 0; i < escaped.length; i += 1) {
    const ch = escaped[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }

    const next = escaped[i + 1];
    if (next == null) {
      out += "\\";
      break;
    }

    switch (next) {
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "v":
        out += "\v";
        break;
      case "0":
        out += "\0";
        break;
      case "'":
        out += "'";
        break;
      case '"':
        out += '"';
        break;
      case "\\":
        out += "\\";
        break;
      default:
        out += next;
        break;
    }

    i += 1;
  }

  return out;
};

const extractTsConst = (src: string, name: string) => {
  const marker = `export const ${name} = '`;
  const start = src.indexOf(marker);
  if (start === -1) return "";

  let i = start + marker.length;
  let out = "";
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      if (i + 1 < src.length) {
        out += ch + src[i + 1];
        i += 2;
        continue;
      }
      out += ch;
      break;
    }
    if (ch === "'") {
      return decodeJsSingleQuoted(out);
    }
    out += ch;
    i += 1;
  }

  return "";
};

const extractTemplateContent = (jsonSrc: string, workflowPath: string) => {
  const entries = JSON.parse(jsonSrc) as Array<{ path: string; content: string }>;
  return entries.find((entry) => entry.path === workflowPath)?.content ?? "";
};

const extractNamedTemplateLiteral = (src: string, workflowPath: string) => {
  const marker = `"${workflowPath}": \``;
  const start = src.indexOf(marker);
  if (start === -1) return "";

  let i = start + marker.length;
  let out = "";

  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      out += ch;
      if (i + 1 < src.length) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      break;
    }
    if (ch === "`") return out;
    out += ch;
    i += 1;
  }

  return out;
};

const GENERIC_SAFE_REF_REGEX = "^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$";
const CI_LITE_ALLOWED_REF_REGEX = "^(work|codex|main|dev|develop|release/.+|feature/.+|hotfix/.+)$";

const extractYamlInputDefault = (src: string, inputName: string) => {
  const header = `${inputName}:`;
  const start = src.indexOf(header);
  if (start === -1) return "";

  const match = src.slice(start).match(/default: "([^"]+)"/);
  return match?.[1] ?? "";
};

const isGuardedCiLiteBranch = (branch: string, allowed: RegExp) =>
  Boolean(branch) &&
  !/^[0-9a-fA-F]{7,40}$/.test(branch) &&
  !/[ :]/.test(branch) &&
  allowed.test(branch);

const expectExplicitRefContract = (src: string) => {
  expect(src).toContain("required: true");
  expect(src).not.toContain("github.ref_name");
  expect(src).not.toContain("client_payload.branch");
};

const expectRequiredRefBlocks = (src: string, expectedCount: number) => {
  const blocks = findRefBlocks(src);
  expect(blocks).toHaveLength(expectedCount);
  for (const block of blocks) {
    expect(block).toContain("required: true");
    expect(block).not.toContain('default: ""');
  }
};

describe("Patch 414 workflow ref SoT invariants", () => {
  it("hardens live build workflows to explicit refs", () => {
    const eas = read(".github/workflows/eas-build.yml");
    const release = read(".github/workflows/release-build.yml");
    const autofix = read(".github/workflows/k1w1-ci-lite-autofix.yml");
    const triggered = read(".github/workflows/k1w1-triggered-build.yml");

    expectRequiredRefBlocks(eas, 2);
    expectRequiredRefBlocks(release, 1);
    expectRequiredRefBlocks(autofix, 1);
    expectRequiredRefBlocks(triggered, 1);

    expectExplicitRefContract(eas);
    expectExplicitRefContract(release);
    expectExplicitRefContract(autofix);
    expectExplicitRefContract(triggered);

    expect(triggered).toContain("Missing required ref.");
    expect(triggered).toContain("needs: resolve");
    expect(triggered).toContain("ref: ${{ needs.resolve.outputs.ref }}");
  });

  it("keeps the production keystore request bound to the explicit workflow ref", () => {
    const eas = read(".github/workflows/eas-build.yml");
    expect(eas).toContain("WORKFLOW_REF: ${{ inputs.ref }}");
    expect(eas).toContain('ref: process.env.WORKFLOW_REF || "",');
    expect(eas).not.toContain('ref: process.env.INPUT_REF || "",');
    expect(eas).not.toContain('ref: process.env.GITHUB_REF_NAME || "",');
  });

  it("keeps the embedded build workflow templates aligned with the live contract", () => {
    const templatesTs = read("lib/diagnostics/workflowTemplates.ts");
    const sharedBuildReleaseTs = read("shared/workflows/easBuildReleaseWorkflowTemplates.ts");
    const sharedTriggeredTs = read("shared/workflows/k1w1TriggeredBuildWorkflowTemplate.ts");
    const baseJson = read("templates/expo-sdk54-base.json");
    const fullJson = read("templates/expo-sdk54-full.json");

    const tsTriggered = extractTsConst(sharedTriggeredTs, "WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE");
    const tsEas = extractTsConst(sharedBuildReleaseTs, "WORKFLOW_EAS_BUILD_TEMPLATE");
    const tsRelease = extractTsConst(sharedBuildReleaseTs, "WORKFLOW_RELEASE_BUILD_TEMPLATE");

    const baseTriggered = extractTemplateContent(baseJson, ".github/workflows/k1w1-triggered-build.yml");
    const baseEas = extractTemplateContent(baseJson, ".github/workflows/eas-build.yml");
    const baseRelease = extractTemplateContent(baseJson, ".github/workflows/release-build.yml");

    const fullEas = extractTemplateContent(fullJson, ".github/workflows/eas-build.yml");
    const fullRelease = extractTemplateContent(fullJson, ".github/workflows/release-build.yml");

    for (const src of [tsTriggered, tsEas, tsRelease, baseTriggered, baseEas, baseRelease, fullEas, fullRelease]) {
      expect(src).toBeTruthy();
      expectExplicitRefContract(src);
    }

    expectRequiredRefBlocks(tsEas, 2);
    expectRequiredRefBlocks(baseEas, 2);
    expectRequiredRefBlocks(fullEas, 2);
    expectRequiredRefBlocks(tsRelease, 1);
    expectRequiredRefBlocks(baseRelease, 1);
    expectRequiredRefBlocks(fullRelease, 1);
    expectRequiredRefBlocks(tsTriggered, 1);
    expectRequiredRefBlocks(baseTriggered, 1);

    expect(templatesTs).toContain("export const WORKFLOW_EAS_BUILD = WORKFLOW_EAS_BUILD_TEMPLATE;");
    expect(templatesTs).toContain("export const WORKFLOW_RELEASE_BUILD = WORKFLOW_RELEASE_BUILD_TEMPLATE;");
    expect(templatesTs).toContain("export const WORKFLOW_K1W1_TRIGGERED_BUILD = WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE;");

    expect(tsTriggered).toContain("Missing required ref.");
    expect(baseTriggered).toContain("Missing required ref.");
    expect(tsEas).toContain('process.env.WORKFLOW_REF || "",');
    expect(baseEas).toContain('process.env.WORKFLOW_REF || "",');
    expect(fullEas).toContain('process.env.WORKFLOW_REF || "",');
  });

  it("keeps determine-ref generic while CI Lite callers set the narrower branch policy explicitly", () => {
    const determineRef = read(".github/actions/determine-ref/action.yml");
    const ciLite = read(".github/workflows/k1w1-ci-lite.yml");
    const autofix = read(".github/workflows/k1w1-ci-lite-autofix.yml");

    expect(extractYamlInputDefault(determineRef, "allowed_ref_regex")).toBe(GENERIC_SAFE_REF_REGEX);
    expect(ciLite).toContain(`ALLOWED_REF_REGEX: "${CI_LITE_ALLOWED_REF_REGEX}"`);
    expect(ciLite).toContain("allowed_ref_regex: ${{ env.ALLOWED_REF_REGEX }}");
    expect(autofix).toContain(`ALLOWED_REF_REGEX: "${CI_LITE_ALLOWED_REF_REGEX}"`);
    expect(autofix).toContain("allowed_ref_regex: ${{ env.ALLOWED_REF_REGEX }}");
  });

  it("keeps the CI Lite ref policy aligned across live workflows, infra templates, and edge dispatch templates", () => {
    const ciLite = read(".github/workflows/k1w1-ci-lite.yml");
    const autofix = read(".github/workflows/k1w1-ci-lite-autofix.yml");
    const sharedTemplates = read("shared/workflows/managedWorkflowTemplates.ts");
    const infraTemplates = read("infra/github/workflowTemplates.ts");
    const edgeTemplates = read("supabase/functions/github-workflow-dispatch/index.ts");
    const sharedCiLite = extractNamedTemplateLiteral(sharedTemplates, "k1w1-ci-lite.yml");
    const sharedAutofix = extractNamedTemplateLiteral(sharedTemplates, "k1w1-ci-lite-autofix.yml");
    const legacyRegex = "^(work|main|dev|develop|release/.+|feature/.+|hotfix/.+)$";

    expect(ciLite).toContain(`ALLOWED_REF_REGEX: "${CI_LITE_ALLOWED_REF_REGEX}"`);
    expect(ciLite).toContain("allowed_ref_regex: ${{ env.ALLOWED_REF_REGEX }}");
    expect(ciLite).not.toContain(`ALLOWED_REF_REGEX: "${legacyRegex}"`);
    expect(ciLite).not.toContain(`allowed_ref_regex: "${legacyRegex}"`);

    for (const src of [sharedCiLite]) {
      expect(src).toContain(`ALLOWED_REF_REGEX: "${CI_LITE_ALLOWED_REF_REGEX}"`);
      expect(src).toContain("allowed_ref_regex: \\${{ env.ALLOWED_REF_REGEX }}");
      expect(src).not.toContain(`ALLOWED_REF_REGEX: "${legacyRegex}"`);
      expect(src).not.toContain(`allowed_ref_regex: "${legacyRegex}"`);
    }

    expect(autofix).toContain(`ALLOWED_REF_REGEX: "${CI_LITE_ALLOWED_REF_REGEX}"`);
    expect(autofix).toContain("allowed_ref_regex: ${{ env.ALLOWED_REF_REGEX }}");
    expect(autofix).not.toContain(`ALLOWED_REF_REGEX: "${legacyRegex}"`);
    expect(autofix).not.toContain(`allowed_ref_regex: "${legacyRegex}"`);

    for (const src of [sharedAutofix]) {
      expect(src).toContain(`ALLOWED_REF_REGEX: "${CI_LITE_ALLOWED_REF_REGEX}"`);
      expect(src).toContain("allowed_ref_regex: \\${{ env.ALLOWED_REF_REGEX }}");
      expect(src).not.toContain(`ALLOWED_REF_REGEX: "${legacyRegex}"`);
      expect(src).not.toContain(`allowed_ref_regex: "${legacyRegex}"`);
    }


    expect(infraTemplates).toContain("managedWorkflowTemplates");
    expect(edgeTemplates).toContain("missing_workflow");
    expect(edgeTemplates).not.toContain("managedWorkflowTemplates");
    expect(autofix).toContain("- name: Determine target branch");
    expect(autofix).toContain("TARGET_BRANCH=${{ steps.target_ref.outputs.checkout_ref }}");
    expect(autofix).not.toContain("inputs.ref || github.ref_name");

    for (const src of [sharedAutofix]) {
      expect(src).toContain("- name: Determine target branch");
      expect(src).toContain("TARGET_BRANCH=\\${{ steps.target_ref.outputs.checkout_ref }}");
      expect(src).not.toContain("inputs.ref || github.ref_name");
    }
  });

  it("accepts codex while continuing to block unsafe CI Lite refs", () => {
    const allowed = new RegExp(CI_LITE_ALLOWED_REF_REGEX);

    expect(allowed.test("codex")).toBe(true);
    expect(isGuardedCiLiteBranch("codex", allowed)).toBe(true);

    expect(allowed.test("refs/pull/1/head")).toBe(false);
    expect(isGuardedCiLiteBranch("main:evil", allowed)).toBe(false);
    expect(isGuardedCiLiteBranch("deadbeef", allowed)).toBe(false);
  });

  it("documents CI Lite as a branch-oriented exception instead of a ref-only path", () => {
    const workflowReadme = read(".github/workflows/README.md");
    const todo = read("docs/TODO.md");
    expect(workflowReadme).toContain("CI-Lite-Chain bleibt bewusst branch-basiert");
    expect(todo).toContain("CI-Lite-Chain bleibt bewusst branch-basiert");
  });
});
