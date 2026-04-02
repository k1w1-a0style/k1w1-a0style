import type { MutableRefObject } from "react";

import type { ProjectData, ProjectFile } from "../../shared/types/project";
import type { PreflightCheckResult, PreflightPatch } from "../../lib/diagnostics/preflightTypes";
import { makeProjectData } from "./projectTestHelpers";

export function makePreflightPatch(overrides: Partial<PreflightPatch> = {}): PreflightPatch {
  return {
    upsert: [],
    delete: [],
    jsonMerge: [],
    ...overrides,
  };
}

export function makePreflightResult(
  overrides: Partial<PreflightCheckResult> = {},
): PreflightCheckResult {
  return {
    id: "test-check",
    title: "Test check",
    status: "fail",
    severity: "normal",
    ...overrides,
  };
}

export function makeProjectRef(
  overrides: Partial<ProjectData> = {},
): MutableRefObject<ProjectData | null> {
  return {
    current: makeProjectData(overrides),
  };
}


type JsonMergeEntry = NonNullable<PreflightPatch["jsonMerge"]>[number];

export function makeProjectFile(path: string, content = "{}"): ProjectFile {
  return { path, content };
}

export function makePreflightJsonMergePatch(
  path: string,
  patch: unknown,
  createIfMissing = false,
): JsonMergeEntry {
  return { path, patch, createIfMissing };
}
