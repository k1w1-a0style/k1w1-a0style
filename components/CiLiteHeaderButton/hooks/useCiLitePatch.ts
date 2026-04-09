// components/CiLiteHeaderButton/hooks/useCiLitePatch.ts
// Handles: patch validation, application to project + auto-sync to GitHub.

import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

import { useProject } from "../../../contexts/ProjectContext";
import { getGitHubToken } from "../../../infra/github/tokenStore";
import {
  deleteRepoFile,
  pushFilesToRepo,
} from "../../../infra/github/githubService";
import { normalizePreflightPatch, safeUi } from "../../ciLite/ciLiteUtils";
import { validateFileContent, validateFilePath } from "../../../lib/validators";
import {
  checkPatchLimits,
  analyzePatchRisk,
  patchTouchedPaths,
} from "../../../lib/diagnostics/fixSafety";
import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import type { ProjectFile } from "../../../shared/types/project";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { logger } from "../../../lib/logger";

interface UseCiLitePatchOpts {
  githubRepo: string;
  branch: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function useCiLitePatch({ githubRepo, branch }: UseCiLitePatchOpts) {
  const { projectData, updateProjectFiles, deleteFile } = useProject();

  const [patchPanelOpen, setPatchPanelOpen] = useState(false);
  const [patchText, setPatchText] = useState<string>("{");
  const [patchBusy, setPatchBusy] = useState(false);
  const [patchInfo, setPatchInfo] = useState<string | null>(null);

  const pastePatchFromClipboard = useCallback(async () => {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t) return;
      setPatchText(t);
      setPatchInfo(null);
      setPatchPanelOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const validatePatchText = useCallback((): { patch: PreflightPatch; summary: string } => {
    const raw = patchText?.trim();
    if (!raw) throw new Error("Patch JSON ist leer.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      throw new Error(`JSON Parse Fehler: ${getErrorMessage(error, "invalid")}`);
    }

    const patch = normalizePreflightPatch(parsed);
    const touched = patchTouchedPaths(patch);
    const limits = checkPatchLimits(patch);
    const risk = analyzePatchRisk(patch);

    const parts: string[] = [];
    parts.push(`ops=${limits.magnitude.opCount}, files=${limits.magnitude.touchedCount}, chars=${limits.magnitude.charCount}`);
    if (touched.length)
      parts.push(`touched: ${touched.slice(0, 8).join(", ")}${touched.length > 8 ? ` (+${touched.length - 8})` : ""}`);
    if (risk.reasons.length) parts.push(`risk: ${risk.reasons.join(", ")}`);
    if (limits.hardFail) parts.push(`HARD-BLOCK: ${limits.reasons.join("; ")}`);
    else if (limits.softWarn) parts.push(`WARN: ${limits.reasons.join("; ")}`);

    return { patch, summary: parts.join("\n") };
  }, [patchText]);

  const validatePatchAndShow = useCallback(() => {
    try {
      setPatchInfo(validatePatchText().summary);
    } catch (error: unknown) {
      const msg = getErrorMessage(error, "Patch konnte nicht validiert werden.");
      setPatchInfo(msg);
      Alert.alert("Apply Patch", msg);
    }
  }, [validatePatchText]);

  /** Mirror applied patch to the linked GitHub repo. Non-blocking on failure. */
  const syncPatchToGitHub = useCallback(async (
    nextMap: Map<string, string>,
    deletePaths: string[],
    patch: PreflightPatch,
  ) => {
    try {
      if (!githubRepo || !githubRepo.includes("/")) return;

      const [owner, repo] = githubRepo.split("/");
      const targetBranch = (branch || "").trim();
      if (!targetBranch) {
        throw new Error("Kein Branch verknüpft (Auto-Sync nach Patch).");
      }

      const tok = await getGitHubToken().catch((error: unknown) => {
        logger.warn("[CiLitePatch] getGitHubToken failed during auto-sync", { error });
        return null;
      });
      if (!tok) throw new Error("GitHub Token fehlt (Auto-Sync nach Patch).");

      const touched = patchTouchedPaths(patch);
      const toDelete = new Set(deletePaths);

      const upserts: ProjectFile[] = touched
        .filter((path) => !toDelete.has(path))
        .map((path) => ({ path, content: nextMap.get(path) ?? "" }));

      if (upserts.length) await pushFilesToRepo(owner, repo, upserts, targetBranch);
      for (const path of deletePaths) await deleteRepoFile(owner, repo, path, `Delete ${path}`, targetBranch);

      const files: ProjectFile[] = Array.from(nextMap.entries()).map(([path, content]) => ({ path, content }));
      await markRepoSyncSignature({
        linkedRepo: githubRepo,
        linkedBranch: targetBranch,
        files,
      });
    } catch (syncErr: unknown) {
      const message = getErrorMessage(syncErr, "Auto-Sync fehlgeschlagen.");
      console.warn("[CI Lite] Auto-Sync failed:", message);
      setPatchInfo((prev) => `${prev || ""}\n\n⚠️ Auto-Sync fehlgeschlagen: ${message}`);
    }
  }, [githubRepo, branch]);

  const applyPatchFromText = useCallback(async () => {
    if (!projectData) {
      Alert.alert("Apply Patch", "Kein Projekt geladen.");
      return;
    }
    if (patchBusy) return;

    let patch: PreflightPatch;
    let summary = "";
    try {
      const v = validatePatchText();
      patch = v.patch;
      summary = v.summary;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, "Patch konnte nicht validiert werden.");
      setPatchInfo(msg);
      Alert.alert("Apply Patch", msg);
      return;
    }

    const limits = checkPatchLimits(patch);
    const risk = analyzePatchRisk(patch);
    if (limits.hardFail) {
      Alert.alert("Apply Patch", `Blockiert: ${limits.reasons.join("; ")}`);
      return;
    }

    const needsConfirm = limits.softWarn || risk.reasons.length > 0;

    const doApply = async () => {
      setPatchBusy(true);
      try {
        const filesNow = projectData.files || [];
        const nowMap = new Map(filesNow.map((f) => [f.path, f.content] as const));
        const touchedPaths = patchTouchedPaths(patch);

        for (const p of touchedPaths) {
          const v = validateFilePath(p);
          if (!v.valid || !v.normalized) throw new Error(`Ungültiger Pfad im Patch: ${p}`);
        }

        const nextMap = new Map(nowMap);

        for (const u of patch.upsert ?? []) {
          const pv = validateFilePath(u.path);
          if (!pv.valid || !pv.normalized) throw new Error(`Ungültiger Pfad im Patch: ${u.path}`);
          const cv = validateFileContent(u.content ?? "");
          if (!cv.valid) throw new Error(`Ungültiger File-Content für ${u.path}: ${cv.error ?? "invalid"}`);
          nextMap.set(pv.normalized, u.content ?? "");
        }

        const deletePaths = (patch.delete ?? [])
          .map((p) => { const pv = validateFilePath(p); return pv.valid && pv.normalized ? pv.normalized : null; })
          .filter(Boolean) as string[];

        for (const p of deletePaths) nextMap.delete(p);

        if (patch.jsonMerge?.length) {
          const { applyJsonMergePatchSafe } = await import("../../../lib/diagnostics/smartPatch");
          const merged = await applyJsonMergePatchSafe(
            Array.from(nextMap.entries()).map(([path, content]) => ({ path, content })),
            patch.jsonMerge,
          );
          nextMap.clear();
          for (const f of merged) nextMap.set(f.path, f.content);
        }

        for (const p of deletePaths) await deleteFile(p);
        await updateProjectFiles(Array.from(nextMap.entries()).map(([path, content]) => ({ path, content })));

        // Auto-sync to GitHub
        await syncPatchToGitHub(nextMap, deletePaths, patch);

        setPatchInfo(`✅ Patch applied.\n${summary}`);
      } catch (error: unknown) {
        const msg = getErrorMessage(error, "Patch konnte nicht angewendet werden.");
        setPatchInfo(msg);
        Alert.alert("Apply Patch", msg);
      } finally {
        setPatchBusy(false);
      }
    };

    if (!needsConfirm) {
      await doApply();
      return;
    }

    return new Promise<void>((resolve) => {
      Alert.alert(
        "Apply Patch",
        `Patch wirkt riskant/umfangreich.\n\n${summary}\n\nTrotzdem anwenden?`,
        [
          { text: "Abbrechen", style: "cancel", onPress: () => resolve() },
          { text: "Anwenden", style: "destructive", onPress: async () => { await doApply(); resolve(); } },
        ],
      );
    });
  }, [projectData, patchBusy, validatePatchText, deleteFile, updateProjectFiles, syncPatchToGitHub]);

  return {
    patchPanelOpen, setPatchPanelOpen,
    patchText, setPatchText,
    patchBusy, patchInfo,
    pastePatchFromClipboard,
    validatePatchAndShow,
    applyPatchFromText,
  };
}
