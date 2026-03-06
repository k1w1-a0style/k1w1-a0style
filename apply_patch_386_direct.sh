#!/usr/bin/env bash
set -euo pipefail

cd "${1:-.}"

rm -rf k1w1-patch-386 k1w1-patch-386-fixed k1w1-patch-386-syntaxfixed

python3 - <<'PY'
from pathlib import Path

def replace_once(text: str, old: str, new: str, path: str) -> str:
    if old not in text:
        raise SystemExit(f"[FAIL] pattern not found in {path}")
    return text.replace(old, new, 1)

# AGENTS.md
p = Path("AGENTS.md")
text = p.read_text()
old = """## Patch-ZIP Workflow (so arbeiten wir hier)

Wir liefern Änderungen als **Patch-ZIP** aus, damit sie lokal im Projekt-Root entpackt werden können.

- ZIP-Name: `k1w1-a0style_patch_<PATCHNUM>.zip`
- Inhalt: **nur** geänderte/neue Files (keine kompletten Repo-Dumps)
- Anwendung:

```bash
unzip -o k1w1-a0style_patch_<PATCHNUM>.zip -d .
rm -f k1w1-a0style_patch_<PATCHNUM>.zip

npm run typecheck
npm run lint:ci
npm run test:silent

git add -A
git commit -m "Patch <PATCHNUM>: <kurzer Titel>"
git push origin main
```
"""
new = """## Patch-Artifact Workflow (kanonisch)

Wir liefern Änderungen als **`.patch`-Datei in einer ZIP** aus, damit sie im Projekt-Root
per `git apply` geprüft und angewendet werden können.

- ZIP-Name: `k1w1-a0style_patch_<PATCHNUM>.zip`
- Inhalt:
  - `k1w1-patch-<PATCHNUM>-<slug>.patch`
  - `docs/patches/patch_<PATCHNUM>.md` (oder gleichnamige Notiz im Paket)
  - kurze `README.md`
- Anwendung:

```bash
unzip k1w1-a0style_patch_<PATCHNUM>.zip -d k1w1-patch-<PATCHNUM>
git apply --check k1w1-patch-<PATCHNUM>/**/*.patch
git apply k1w1-patch-<PATCHNUM>/**/*.patch
rm -rf k1w1-patch-<PATCHNUM>
npm run typecheck
npm run lint:ci
npm run test:silent
git add -A
git commit -m "Patch <PATCHNUM>: <kurzer Titel>"
git push origin codex
```

Vor Auslieferung eines Patch-Artefakts:
- `git apply --check` muss lokal erfolgreich sein
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_artifact.sh <patchfile>`
"""
text = replace_once(text, old, new, str(p))
p.write_text(text)

# PROJECT_CHECKLOG.md
p = Path("PROJECT_CHECKLOG.md")
text = p.read_text()
line = "- 2026-03-06 Patch 386: SHA hardening phase 2 + workflow marker completion + patch artifact discipline\n"
if "Patch 386" not in text:
    if not text.endswith("\n"):
        text += "\n"
    text += line
p.write_text(text)

# docs/patches/PATCHLOG_ROOT.md
p = Path("docs/patches/PATCHLOG_ROOT.md")
text = p.read_text()
if "Patch 386" not in text:
    text = text.replace(
        "## Recent\n\n",
        "## Recent\n\n- Patch 386: SHA hardening phase 2 + workflow marker completion + patch artifact discipline\n",
        1,
    )
p.write_text(text)

# docs/patches/patch_386.md
Path("docs/patches/patch_386.md").write_text(
"""# Patch 386 - SHA hardening phase 2 + workflow marker completion + patch artifact discipline

## Goal
Harden the remaining weak points after patches 381-385:
- CI Lite must be tied not only to repo/branch, but also to the exact branch HEAD SHA.
- Managed workflow metadata should be more explicit.
- Patch delivery should follow one canonical `.patch` workflow instead of mixed overlay/zip habits.

## Changes
- Added `CI_LITE_LAST_SHA` storage key.
- CI Lite persistence now stores the exact checked commit SHA (`artifact source_commit_sha` or workflow `head_sha` fallback).
- Build readiness now compares the current branch HEAD SHA with the last green CI Lite SHA and blocks mismatches.
- Added `getBranchHeadSha(owner, repo, branch)` to GitHub branch helpers.
- Added managed markers to `eas-link.yml`.
- Updated `AGENTS.md` to the canonical `.patch` + `git apply` workflow.
- Added `scripts/check_patch_artifact.sh` as a lightweight artifact validator.
- Updated integration tests for the new SHA gate.

## Notes
This patch intentionally tightens build gating.
After applying it, CI Lite may need to be rerun once for the currently selected repo/branch so the SHA cache is populated.
"""
)

# lib/storageKeys.ts
p = Path("lib/storageKeys.ts")
text = p.read_text()
if 'CI_LITE_LAST_SHA' not in text:
    text = text.replace(
        '  CI_LITE_LAST_BRANCH: "ci_lite_last_branch",\n',
        '  CI_LITE_LAST_BRANCH: "ci_lite_last_branch",\n  CI_LITE_LAST_SHA: "ci_lite_last_sha",\n',
        1,
    )
p.write_text(text)

# infra/github/branchOps.ts
p = Path("infra/github/branchOps.ts")
text = p.read_text()
if "export const getBranchHeadSha" not in text:
    text += """

export const getBranchHeadSha = async (
  owner: string,
  repo: string,
  branch: string,
): Promise<string> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const b = branch.trim();
  if (!b) throw new Error("Branch-Name ist leer.");

  await githubLimiter.checkLimit();

  const resp = await fetch(
    githubApiUrl(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(b)}`), {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403) throw new Error("Keine Berechtigung.");
    if (resp.status === 404) throw new Error("Branch oder Repo nicht gefunden.");
    throw new Error(json.message || `Branch-HEAD Fehler (${resp.status})`);
  }

  const sha = String(json?.object?.sha || "").trim();
  if (!sha) throw new Error("Konnte Branch-HEAD-SHA nicht ermitteln.");
  return sha;
};
"""
p.write_text(text)

# infra/github/repos.ts
p = Path("infra/github/repos.ts")
text = p.read_text()
if "getBranchHeadSha" not in text:
    text = text.replace(
        'export { createBranch, deleteBranch, renameBranch, getBranches, getDefaultBranch } from "./branchOps";\n',
        'export { createBranch, deleteBranch, renameBranch, getBranches, getDefaultBranch, getBranchHeadSha } from "./branchOps";\n',
        1,
    )
p.write_text(text)

# project/services/buildStartService.ts
p = Path("project/services/buildStartService.ts")
text = p.read_text()
text = text.replace(
    '  getEdgeAdminKey,\n  pushFilesToRepo,\n} from "../../infra/github/githubService";\n',
    '  getEdgeAdminKey,\n  getBranchHeadSha,\n  pushFilesToRepo,\n} from "../../infra/github/githubService";\n',
    1,
)
text = text.replace(
    "export type BuildReadinessDeps = {\n  storageGetItem?: (key: string) => Promise<string | null>;\n};\n",
    "export type BuildReadinessDeps = {\n  storageGetItem?: (key: string) => Promise<string | null>;\n  getBranchHeadSha?: (owner: string, repo: string, branch: string) => Promise<string>;\n};\n",
    1,
)
text = text.replace(
    "  const storageGetItem = deps.storageGetItem ?? ((key: string) => AsyncStorage.getItem(key));\n",
    "  const storageGetItem = deps.storageGetItem ?? ((key: string) => AsyncStorage.getItem(key));\n  const readBranchHeadSha = deps.getBranchHeadSha ?? getBranchHeadSha;\n",
    1,
)
text = text.replace(
    """  const [diagVal, lintVal, typeVal, lastRunAt, lastRepo, lastBranch] = await Promise.all([
    storageGetItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_RUN_AT).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_REPO).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_BRANCH).catch(() => null),
  ]);
""",
    """  const [diagVal, lintVal, typeVal, lastRunAt, lastRepo, lastBranch, lastSha] = await Promise.all([
    storageGetItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_RUN_AT).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_REPO).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_BRANCH).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_SHA).catch(() => null),
  ]);
""",
    1,
)
text = text.replace(
    """  if (Date.now() - ts > CI_LITE_MAX_AGE_MS) {
    throw new Error("Build blockiert: Letzter CI-Lite-Run ist veraltet. Bitte erneut prüfen.");
  }
""",
    """  if (Date.now() - ts > CI_LITE_MAX_AGE_MS) {
    throw new Error("Build blockiert: Letzter CI-Lite-Run ist veraltet. Bitte erneut prüfen.");
  }

  if (!/^[0-9a-f]{40}$/i.test(String(lastSha ?? "").trim())) {
    throw new Error("Build blockiert: Kein gültiger CI-Lite-SHA vorhanden. Bitte CI Lite erneut ausführen.");
  }

  const [owner, repo] = linkedRepo.split("/");
  const currentHeadSha = await readBranchHeadSha(owner, repo, linkedBranch);
  if (!/^[0-9a-f]{40}$/i.test(String(currentHeadSha ?? "").trim())) {
    throw new Error("Build blockiert: Branch-HEAD-SHA konnte nicht ermittelt werden.");
  }

  if (String(lastSha).trim() !== String(currentHeadSha).trim()) {
    throw new Error("Build blockiert: Repo/Branch wurden seit dem letzten grünen CI-Lite-Run geändert (SHA-Mismatch).");
  }
""",
    1,
)
p.write_text(text)

# buildStartService test
p = Path("lib/__tests__/buildStartService.integration.test.ts")
text = p.read_text()
text = text.replace(
    """const mockGitHub = {
  getEdgeAdminKey: jest.fn(),
  pushFilesToRepo: jest.fn(),
};
""",
    """const mockGitHub = {
  getEdgeAdminKey: jest.fn(),
  getBranchHeadSha: jest.fn(),
  pushFilesToRepo: jest.fn(),
};
""",
    1,
)
text = text.replace(
    """        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return "main";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
""",
    """        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return "main";
        case STORAGE_KEYS.CI_LITE_LAST_SHA:
          return "1111111111111111111111111111111111111111";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
""",
    1,
)
text = text.replace(
    '    mockGitHub.getEdgeAdminKey.mockResolvedValue("adminkey");\n',
    '    mockGitHub.getEdgeAdminKey.mockResolvedValue("adminkey");\n    mockGitHub.getBranchHeadSha.mockResolvedValue("1111111111111111111111111111111111111111");\n',
    1,
)
text = text.replace(
    """        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return "dev";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
""",
    """        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return "dev";
        case STORAGE_KEYS.CI_LITE_LAST_SHA:
          return "1111111111111111111111111111111111111111";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
""",
    1,
)
p.write_text(text)

# useCiLiteWorkflow.ts
p = Path("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts")
text = p.read_text()
text = text.replace(
    """  const [artifactResult, setArtifactResult] = useState<
    | { ok: boolean; eslint_exit?: number; tsc_exit?: number }
    | null
  >(null);
""",
    """  const [artifactResult, setArtifactResult] = useState<
    | { ok: boolean; eslint_exit?: number; tsc_exit?: number; source_commit_sha?: string }
    | null
  >(null);
""",
    1,
)
text = text.replace(
    """        const tsc_exit =
          typeof (json as any).tsc_exit === "number" ? (json as any).tsc_exit : undefined;

        if (!cancelled) setArtifactResult({ ok, eslint_exit, tsc_exit });
""",
    """        const tsc_exit =
          typeof (json as any).tsc_exit === "number" ? (json as any).tsc_exit : undefined;
        const source_commit_sha =
          typeof (json as any).source_commit_sha === "string"
            ? String((json as any).source_commit_sha).trim() || undefined
            : undefined;

        if (!cancelled) setArtifactResult({ ok, eslint_exit, tsc_exit, source_commit_sha });
""",
    1,
)
text = text.replace(
    """  useEffect(() => {
    if (!workflowRun || workflowId !== WORKFLOW_CI_LITE || workflowRun.status !== "completed") return;
    const isSuccess = (workflowRun.conclusion || "").toLowerCase() === "success";
    const lintOk = artifactResult ? artifactResult.eslint_exit === 0 : isSuccess || stepInfo.lint === "success";
    const typeOk = artifactResult ? artifactResult.tsc_exit === 0 : isSuccess || stepInfo.typecheck === "success";
    void AsyncStorage.multiSet([
      [STORAGE_KEYS.CI_LITE_LINT_OK, lintOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_TYPECHECK_OK, typeOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_AT, String(Date.now())],
      [STORAGE_KEYS.CI_LITE_LAST_REPO, githubRepo || ""],
      [STORAGE_KEYS.CI_LITE_LAST_BRANCH, (targetRef || branch || "").trim()],
      [STORAGE_KEYS.CI_LITE_LAST_WORKFLOW, workflowId],
      [STORAGE_KEYS.CI_LITE_LAST_JOB_ID, jobId || ""],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_ID, workflowRun?.id != null ? String(workflowRun.id) : ""],
      [STORAGE_KEYS.CI_LITE_LAST_CONCLUSION, String(workflowRun.conclusion || "")],
    ]).catch(() => {});
  }, [
""",
    """  useEffect(() => {
    if (!workflowRun || workflowId !== WORKFLOW_CI_LITE || workflowRun.status !== "completed") return;
    const isSuccess = (workflowRun.conclusion || "").toLowerCase() === "success";
    const lintOk = artifactResult ? artifactResult.eslint_exit === 0 : isSuccess || stepInfo.lint === "success";
    const typeOk = artifactResult ? artifactResult.tsc_exit === 0 : isSuccess || stepInfo.typecheck === "success";
    const sourceCommitSha =
      String(
        artifactResult?.source_commit_sha ||
        (workflowRun as any)?.head_sha ||
        "",
      ).trim();

    void AsyncStorage.multiSet([
      [STORAGE_KEYS.CI_LITE_LINT_OK, lintOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_TYPECHECK_OK, typeOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_AT, String(Date.now())],
      [STORAGE_KEYS.CI_LITE_LAST_REPO, githubRepo || ""],
      [STORAGE_KEYS.CI_LITE_LAST_BRANCH, (targetRef || branch || "").trim()],
      [STORAGE_KEYS.CI_LITE_LAST_SHA, sourceCommitSha],
      [STORAGE_KEYS.CI_LITE_LAST_WORKFLOW, workflowId],
      [STORAGE_KEYS.CI_LITE_LAST_JOB_ID, jobId || ""],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_ID, workflowRun?.id != null ? String(workflowRun.id) : ""],
      [STORAGE_KEYS.CI_LITE_LAST_CONCLUSION, String(workflowRun.conclusion || "")],
    ]).catch(() => {});
  }, [
""",
    1,
)
p.write_text(text)

# eas-link.yml
p = Path(".github/workflows/eas-link.yml")
text = p.read_text()
if not text.startswith("# managed-by: k1w1"):
    text = "# managed-by: k1w1\n# workflow-version: 4\n" + text
p.write_text(text)

# script
p = Path("scripts/check_patch_artifact.sh")
p.write_text("""#!/usr/bin/env bash
set -euo pipefail

PATCH_FILE="${1:-}"
if [ -z "$PATCH_FILE" ]; then
  echo "Usage: $0 <patch-file>" >&2
  exit 2
fi

if [ ! -f "$PATCH_FILE" ]; then
  echo "Patch file not found: $PATCH_FILE" >&2
  exit 2
fi

grep -q '^diff --git ' "$PATCH_FILE" || { echo "Missing diff headers"; exit 1; }
grep -q '^@@ ' "$PATCH_FILE" || { echo "Missing hunk headers"; exit 1; }

git apply --check "$PATCH_FILE"
echo "Patch artifact looks syntactically valid and applies cleanly."
""")
p.chmod(0o755)

print("Patch 386 direct apply finished.")
PY

echo
echo "Now run:"
echo "npm run typecheck && npm run lint:ci && npm run test:silent"
