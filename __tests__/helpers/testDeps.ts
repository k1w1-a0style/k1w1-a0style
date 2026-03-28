import fs from "fs";
import path from "path";

import type { BuildPipelineDiagnosticsDeps } from "../../lib/diagnostics/buildPipelineDiagnostics";
import type { ProjectFile } from "../../shared/types/project";

export function loadFixtureFiles(fixtureName: string): ProjectFile[] {
  const root = path.join(process.cwd(), "test/fixtures/smokeRepos", fixtureName);
  if (!fs.existsSync(root)) return [];

  const files: ProjectFile[] = [];
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const rel = path.relative(root, full).replace(/\\/g, "/");
      files.push({ path: rel, content: fs.readFileSync(full, "utf8") });
    }
  };

  walk(root);
  return files;
}

export function createPipelineDepsFromProjectFiles(
  files: ProjectFile[],
  opts?: {
    ghToken?: string | null;
    expoToken?: string | null;
    workflowAdminKey?: string | null;
    androidKeystoreExportAdminKey?: string | null;
    edgeAdminKey?: string | null;
    secretNames?: string[];
  },
): Required<BuildPipelineDiagnosticsDeps> {
  const map = new Map(files.map((f) => [f.path, f.content] as const));
  return {
    getGitHubToken: jest.fn(async () => opts?.ghToken ?? "gh_test"),
    getExpoToken: jest.fn(async () => opts?.expoToken ?? "expo_test"),
    getWorkflowAdminKey: jest.fn(async () => opts?.workflowAdminKey ?? "workflow_test"),
    getAndroidKeystoreExportAdminKey: jest.fn(
      async () => opts?.androidKeystoreExportAdminKey ?? "keystore_test",
    ),
    getEdgeAdminKey: jest.fn(async () => opts?.edgeAdminKey ?? "edge_test"),
    fileExists: jest.fn(async (_o, _r, targetPath) => map.has(targetPath)),
    readJsonFile: jest.fn(async (_o, _r, targetPath) => {
      const raw = map.get(targetPath);
      if (typeof raw !== "string") return null;
      return JSON.parse(raw);
    }),
    getRepoFileText: jest.fn(async ({ path: targetPath }: { path: string }) => {
      const text = map.get(targetPath);
      if (typeof text !== "string") {
        throw new Error(`missing ${targetPath}`);
      }
      return text;
    }),
    listRepoSecretNames: jest.fn(async () => opts?.secretNames ?? ["EXPO_TOKEN"]),
  };
}

export function createDeterministicTestDeps() {
  return {
    now: () => new Date("2026-01-01T00:00:00.000Z").toISOString(),
    uuid: () => "00000000-0000-0000-0000-000000000000",
  };
}
