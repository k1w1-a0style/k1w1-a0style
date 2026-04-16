import type { MutableRefObject } from "react";

import type { ProjectData, ProjectFile } from "../../../shared/types/project";
import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { DiagnosticFixApplyError } from "../../../lib/diagnostics/fixResultContract";
import { findOwnershipViolations } from "../../../lib/projectOwnership";
import type { FixHistoryEntry } from "../types";
import {
  applyUndoHistoryEntry,
  buildPatchApplyState,
  collectNormalizedTouchedPaths,
  countPatchOperations,
} from "./fixRunnerMutationHelpers";
import { sameProjectFiles } from "./useDiagnosticFixRunnerHelpers";

export type ApplyPatchLocalResult = {
  status: "patch_applied";
  localChangeApplied: boolean;
  partial: boolean;
  nextFiles: ProjectFile[];
  historyEntry: FixHistoryEntry;
};

export async function applyPatchLocally(params: {
  label: string;
  patch: PreflightPatch;
  projectRef: MutableRefObject<ProjectData | null>;
  deleteFile: (path: string) => Promise<void>;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
}): Promise<ApplyPatchLocalResult> {
  const { label, patch, projectRef, deleteFile: _deleteFile, updateProjectFiles } = params;
  void _deleteFile;

  const project = projectRef.current;
  if (!project) throw new Error("Kein Projekt geladen.");

  const currentFiles = project.files;
  const operationCount = countPatchOperations(patch);
  if (operationCount === 0) {
    throw new DiagnosticFixApplyError({
      message: "Patch enthält keine anwendbaren Änderungen.",
      status: "blocked",
    });
  }

  try {
    const normalizedTouched = collectNormalizedTouchedPaths(patch);

    const ownershipViolations = findOwnershipViolations("diagnosisAutofix", normalizedTouched);
    if (ownershipViolations.length) {
      const details = ownershipViolations
        .map((v) => `- ${v.path}: ${v.reason}`)
        .join("\n");
      throw new Error(
        `Patch überschreitet Ownership-Grenzen und wurde blockiert:\n${details}`,
      );
    }

    const { nextFiles, snapshot, createdPaths } = await buildPatchApplyState({
      patch,
      currentFiles,
      applyJsonMerge: async (files, jsonMerge) => {
        const { applyJsonMergePatchSafe } = await import("../../../lib/diagnostics/smartPatch");
        return applyJsonMergePatchSafe(files, jsonMerge);
      },
    });

    if (sameProjectFiles(currentFiles, nextFiles)) {
      throw new DiagnosticFixApplyError({
        message: "Patch hat lokal keine wirksamen Änderungen erzeugt.",
        status: "blocked",
      });
    }

    await updateProjectFiles(nextFiles);

    return {
      status: "patch_applied",
      localChangeApplied: true,
      partial: false,
      nextFiles,
      historyEntry: { label, at: Date.now(), snapshot, createdPaths },
    };
  } catch (error: unknown) {
    if (error instanceof DiagnosticFixApplyError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Patch konnte nicht angewendet werden.";
    throw new DiagnosticFixApplyError({
      message,
      status: "failed",
      partial: false,
      localChangeApplied: false,
    });
  }
}

export async function undoHistoryEntry(params: {
  entry: FixHistoryEntry;
  deleteFile: (path: string) => Promise<void>;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
}) {
  await applyUndoHistoryEntry(params);
}

export async function undoHistoryEntries(params: {
  entries: FixHistoryEntry[];
  deleteFile: (path: string) => Promise<void>;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
}): Promise<{ undone: number; failedMessage?: string }> {
  let undone = 0;
  for (const entry of params.entries) {
    try {
      await applyUndoHistoryEntry({
        entry,
        deleteFile: params.deleteFile,
        updateProjectFiles: params.updateProjectFiles,
      });
      undone++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      return { undone, failedMessage: msg };
    }
  }
  return { undone };
}
