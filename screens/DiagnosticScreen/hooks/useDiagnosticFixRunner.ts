import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import type { ProjectData, ProjectFile } from "../../../contexts/types";
import type {
  PreflightCheckResult,
  PreflightPatch,
} from "../../../lib/diagnostics/preflightTypes";
import { safeTruncateText } from "../../../lib/diagnostics/sanitize";
import { patchFingerprint, summarizeBatchRisk } from "../../../lib/diagnostics/fixSafety";
import { validateFileContent, validateFilePath } from "../../../lib/validators";
import { createOrUpdateFile, deleteRepoFile } from "../../../contexts/githubService";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";

import type {
  FixHistoryEntry,
  FixStep,
  FixStepStatus,
  Status,
} from "../types";

const MAX_HISTORY = 10;
const AUTOFIX_MAX = 50; // safety: don't apply endless chains

type ToastLike = { show: (msg: string) => void };

export function useDiagnosticFixRunner(opts: {
  projectRef: MutableRefObject<ProjectData | null>;
  mountedRef: MutableRefObject<boolean>;
  linkedRepo: string;
  linkedBranch?: string;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;

  // Fix options
  syncFixesToGitHub: boolean;
  rerunAfterFix: boolean;
  autoFixIncludeWarn: boolean;
  autoFixScope: "visible" | "all";

  // Lists
  sortedResults: PreflightCheckResult[];
  visibleResults: PreflightCheckResult[];
  fixableResults: PreflightCheckResult[];

  // Selection state (owned by parent)
  selected: Record<string, boolean>;
  setSelected: Dispatch<SetStateAction<Record<string, boolean>>>;

  // Diagnostics re-run callback
  runDiagnostics: (opts?: { resetSelection?: boolean; resetHistory?: boolean }) => Promise<void>;

  // Optional toast
  toast?: ToastLike;

  // Optional: parent can trigger history reset (e.g. on a fresh diagnostics run)
  clearHistoryRef?: MutableRefObject<null | (() => void)>;
}) {
  const {
    projectRef,
    mountedRef,
    linkedRepo,
    linkedBranch,
    updateProjectFiles,
    deleteFile,
    syncFixesToGitHub,
    rerunAfterFix,
    autoFixIncludeWarn,
    autoFixScope,
    sortedResults,
    visibleResults,
    fixableResults,
    selected,
    setSelected,
    runDiagnostics,
    toast,
    clearHistoryRef,
  } = opts;

  const [history, setHistory] = useState<FixHistoryEntry[]>([]);

  // Allow parent to reset undo history without creating a circular dependency.
  useEffect(() => {
    if (!clearHistoryRef) return;
    clearHistoryRef.current = () => setHistory([]);
    return () => {
      // avoid keeping a stale closure around
      if (clearHistoryRef.current) clearHistoryRef.current = null;
    };
  }, [clearHistoryRef]);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLabel, setPreviewLabel] = useState("");
  const [previewEntries, setPreviewEntries] = useState<
    Array<{ path: string; oldText: string | null; newText: string | null }>
  >([]);

  const [applyBusy, setApplyBusy] = useState(false);
  const applyBusyRef = useRef(false);

  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [fixModalTitle, setFixModalTitle] = useState("AutoFix");
  const [fixModalSubtitle, setFixModalSubtitle] = useState<string | undefined>(
    undefined,
  );
  const [fixSteps, setFixSteps] = useState<FixStep[]>([]);
  const [fixStepIndex, setFixStepIndex] = useState(0);
  const [fixDone, setFixDone] = useState(false);

  const closeFixModal = useCallback(() => {
    if (!fixDone) return; // only closable when done
    setFixModalVisible(false);
  }, [fixDone]);

  const openPreview = useCallback(async (label: string, patch: PreflightPatch) => {
    if (!projectRef.current) return;
    const filesMap = new Map(projectRef.current.files.map((f) => [f.path, f.content]));

    const entries: Array<{ path: string; oldText: string | null; newText: string | null }> = [];

    for (const u of patch.upsert ?? []) {
      entries.push({
        path: u.path,
        oldText: filesMap.has(u.path) ? (filesMap.get(u.path) as string) : null,
        newText: u.content ?? "",
      });
    }
    for (const p of patch.delete ?? []) {
      entries.push({
        path: p,
        oldText: filesMap.has(p) ? (filesMap.get(p) as string) : null,
        newText: null,
      });
    }
    for (const j of patch.jsonMerge ?? []) {
      entries.push({
        path: j.path,
        oldText: filesMap.has(j.path) ? (filesMap.get(j.path) as string) : null,
        newText: "• JSON merge patch (Preview zeigt nur vorher – nachher wird beim Apply erzeugt)",
      });
    }

    setPreviewLabel(label);
    setPreviewEntries(entries);
    setPreviewVisible(true);
  }, [projectRef]);

  const patchTouchedPaths = useCallback((patch: PreflightPatch): string[] => {
    const raw = [
      ...(patch.upsert ?? []).map((u) => u.path),
      ...(patch.delete ?? []).map((p) => p),
      ...(patch.jsonMerge ?? []).map((j) => j.path),
    ];
    const out: string[] = [];
    for (const p of raw) {
      const v = validateFilePath(p);
      if (v.valid && v.normalized) out.push(v.normalized);
    }
    return Array.from(new Set(out)).sort();
  }, []);

  const shouldSyncPatch = useCallback(
    (patch: PreflightPatch): boolean => {
      if (!syncFixesToGitHub) return false;
      if (!parseOwnerRepo(linkedRepo)) return false;

      const touched = patchTouchedPaths(patch);
      return touched.some((p) => {
        if (p === "eas.json") return true;
        if (p === "eas-project.json") return true;
        if (p === "package.json") return true;
        if (p === "app.json" || p === "app.config.js" || p === "app.config.ts") return true;
        if (p.startsWith(".github/workflows/")) return true;
        return false;
      });
    },
    [linkedRepo, patchTouchedPaths, syncFixesToGitHub],
  );

  const syncPatchToGitHub = useCallback(
    async (label: string, patch: PreflightPatch) => {
      const parsed = parseOwnerRepo(linkedRepo);
      if (!parsed) throw new Error("Kein verknüpftes Repo gefunden (owner/repo).");

      const branch = (linkedBranch || "main").trim() || "main";
      const touched = patchTouchedPaths(patch);

      const deletedSet = new Set(
        (patch.delete ?? [])
          .map((p) => {
            const v = validateFilePath(p);
            return v.valid && v.normalized ? v.normalized : null;
          })
          .filter(Boolean) as string[],
      );

      const filesNow = projectRef.current?.files ?? [];
      const nowMap = new Map(filesNow.map((f) => [f.path, f.content] as const));

      for (const p of touched) {
        if (deletedSet.has(p)) continue;
        const content = nowMap.get(p);
        if (typeof content !== "string") continue;
        await createOrUpdateFile(
          parsed.owner,
          parsed.repo,
          p,
          content,
          `Diagnostics: ${label}`,
          branch,
        );
      }

      for (const p of Array.from(deletedSet)) {
        await deleteRepoFile(parsed.owner, parsed.repo, p, `Diagnostics: ${label}`, branch);
      }
    },
    [linkedRepo, linkedBranch, patchTouchedPaths, projectRef],
  );

  const applyPatch = useCallback(
    async (label: string, patch: PreflightPatch) => {
      if (!projectRef.current) throw new Error("Kein Projekt geladen.");
      if (applyBusyRef.current) return;

      applyBusyRef.current = true;
      if (mountedRef.current) setApplyBusy(true);

      const currentFiles = projectRef.current.files;
      try {
        const touchedPaths = Array.from(
          new Set<string>([
            ...(patch.upsert ?? []).map((u) => u.path),
            ...(patch.delete ?? []).map((p) => p),
            ...(patch.jsonMerge ?? []).map((j) => j.path),
          ]),
        );

        const normalizedTouched = touchedPaths
          .map((p) => {
            const v = validateFilePath(p);
            if (!v.valid || !v.normalized)
              throw new Error(`Ungültiger Pfad im Patch: ${p} (${v.errors.join(", ") || "invalid"})`);
            return v.normalized;
          })
          .sort();

        const currentMap = new Map(currentFiles.map((f) => [f.path, f] as const));
        const snapshot: ProjectFile[] = [];
        const createdPaths: string[] = [];
        for (const p of normalizedTouched) {
          const prev = currentMap.get(p);
          if (prev) snapshot.push(prev);
          else createdPaths.push(p);
        }

        const nextMap = new Map(currentFiles.map((f) => [f.path, f.content] as const));

        for (const u of patch.upsert ?? []) {
          const pv = validateFilePath(u.path);
          if (!pv.valid || !pv.normalized)
            throw new Error(`Ungültiger Pfad im Patch: ${u.path} (${pv.errors.join(", ") || "invalid"})`);
          const cv = validateFileContent(u.content ?? "");
          if (!cv.valid) throw new Error(`Ungültiger File-Content für ${u.path}: ${cv.error ?? "unknown"}`);
          nextMap.set(pv.normalized, u.content ?? "");
        }

        for (const p of patch.delete ?? []) {
          const pv = validateFilePath(p);
          if (!pv.valid || !pv.normalized)
            throw new Error(`Ungültiger Pfad im Patch: ${p} (${pv.errors.join(", ") || "invalid"})`);
          nextMap.delete(pv.normalized);
        }

        if (patch.jsonMerge?.length) {
          const { applyJsonMergePatchSafe } = await import("../../../lib/diagnostics/smartPatch");
          const merged = await applyJsonMergePatchSafe(
            Array.from(nextMap.entries()).map(([path, content]) => ({ path, content })),
            patch.jsonMerge,
          );
          nextMap.clear();
          for (const f of merged) nextMap.set(f.path, f.content);
        }

        const nextFiles: ProjectFile[] = Array.from(nextMap.entries()).map(([path, content]) => ({
          path,
          content,
        }));

        try {
          for (const p of patch.delete ?? []) {
            const pv = validateFilePath(p);
            if (pv.valid && pv.normalized) await deleteFile(pv.normalized);
          }
        } catch {
          // ignore – updateProjectFiles will still update in-memory state
        }

        await updateProjectFiles(nextFiles);

        try {
          projectRef.current = { ...projectRef.current, files: nextFiles };
        } catch {}

        setHistory((prev) => {
          const entry: FixHistoryEntry = { label, at: Date.now(), snapshot, createdPaths };
          return [entry, ...prev].slice(0, MAX_HISTORY);
        });
      } finally {
        applyBusyRef.current = false;
        if (mountedRef.current) setApplyBusy(false);
      }
    },
    [deleteFile, mountedRef, projectRef, updateProjectFiles],
  );

  const undoLast = useCallback(async () => {
    const last = history[0];
    if (!last) return;
    if (applyBusyRef.current) return;

    applyBusyRef.current = true;
    if (mountedRef.current) setApplyBusy(true);

    try {
      for (const p of last.createdPaths ?? []) await deleteFile(p);
      if (last.snapshot.length) await updateProjectFiles(last.snapshot);
      setHistory((prev) => prev.slice(1));
    } catch (e: any) {
      Alert.alert("Undo fehlgeschlagen", e?.message || "Unbekannter Fehler");
    } finally {
      applyBusyRef.current = false;
      if (mountedRef.current) setApplyBusy(false);
    }
  }, [deleteFile, history, mountedRef, updateProjectFiles]);

  const undoAll = useCallback(async () => {
    if (!history.length) return;

    Alert.alert("Alle Fixes rückgängig machen?", `${history.length} Fix(es) werden zurückgesetzt.`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Undo All",
        style: "destructive",
        onPress: async () => {
          let undone = 0;
          for (const entry of history) {
            try {
              for (const p of entry.createdPaths ?? []) await deleteFile(p);
              if (entry.snapshot.length) await updateProjectFiles(entry.snapshot);
              undone++;
            } catch (e: any) {
              Alert.alert(
                "Undo All fehlgeschlagen",
                `Abgebrochen nach ${undone} Fix(es): ${e?.message || "Unbekannter Fehler"}`,
              );
              break;
            }
          }
          if (mountedRef.current && undone > 0) {
            setHistory((prev) => prev.slice(undone));
            Alert.alert("✓ Undo", `${undone} Fix(es) rückgängig gemacht.`);
          }
        },
      },
    ]);
  }, [deleteFile, history, mountedRef, updateProjectFiles]);

  const applyIssueFix = useCallback(
    async (r: PreflightCheckResult) => {
      if (!r.fix?.patch) return;

      const doSync = shouldSyncPatch(r.fix.patch);

      const steps: FixStep[] = [
        { key: "apply", title: "Apply patch (local)", status: "pending" },
        ...(doSync ? [{ key: "sync", title: "Sync to GitHub", status: "pending" as FixStepStatus }] : []),
        ...(rerunAfterFix
          ? [{ key: "rerun", title: "Re-Run Diagnostics (Verify)", status: "pending" as FixStepStatus }]
          : []),
      ];

      setFixModalTitle("Fix");
      setFixModalSubtitle(r.title);
      setFixSteps(steps);
      setFixStepIndex(0);
      setFixDone(false);
      setFixModalVisible(true);

      setFixSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "running" } : s)));
      try {
        await applyPatch(r.title, r.fix.patch);
        setFixSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "done" } : s)));
      } catch (e: any) {
        setFixSteps((prev) =>
          prev.map((s, i) =>
            i === 0
              ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Fehler", 160) }
              : s,
          ),
        );
        setFixDone(true);
        return;
      }

      let cursor = 1;
      if (doSync) {
        setFixStepIndex(cursor);
        setFixSteps((prev) => prev.map((s, i) => (i === cursor ? { ...s, status: "running" } : s)));
        try {
          await syncPatchToGitHub(r.title, r.fix.patch);
          setFixSteps((prev) => prev.map((s, i) => (i === cursor ? { ...s, status: "done" } : s)));
        } catch (e: any) {
          setFixSteps((prev) =>
            prev.map((s, i) =>
              i === cursor
                ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Sync fehlgeschlagen", 160) }
                : s,
            ),
          );
          setFixDone(true);
          return;
        }
        cursor++;
      }

      if (rerunAfterFix) {
        setFixStepIndex(cursor);
        setFixSteps((prev) => prev.map((s, i) => (i === cursor ? { ...s, status: "running" } : s)));
        try {
          await runDiagnostics({ resetSelection: false, resetHistory: false });
          setFixSteps((prev) => prev.map((s, i) => (i === cursor ? { ...s, status: "done" } : s)));
        } catch (e: any) {
          setFixSteps((prev) =>
            prev.map((s, i) =>
              i === cursor
                ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Verify fehlgeschlagen", 160) }
                : s,
            ),
          );
        }
      }

      setFixDone(true);
      setFixStepIndex(steps.length);
      toast?.show?.("Fix applied");
    },
    [
      applyPatch,
      rerunAfterFix,
      runDiagnostics,
      shouldSyncPatch,
      syncPatchToGitHub,
      toast,
    ],
  );

  const applyFixList = useCallback(
    async (items: PreflightCheckResult[], label: string) => {
      if (!projectRef.current) return;
      if (!items.length) return;

      // --- Safety gate for batch runs ---
      // In batch mode it's easy to "silently" apply changes that touch CI / build plumbing.
      // We do one extra confirmation if any patch looks risky.
      const batch = items
        .filter((r) => !!r.fix?.patch)
        .map((r) => ({ title: r.title, patch: r.fix!.patch }));

      const riskSummary = summarizeBatchRisk(batch);
      if (riskSummary.hasRisk) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Risky batch fix",
            `Einige Fixes betreffen CI/Build/Infra Dateien.\n\nBetroffene Pfade:\n- ${riskSummary.shortPaths.join(
              "\n- ",
            )}${riskSummary.more}\n\nWillst du wirklich fortfahren?`,
            [
              { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
              { text: "Weiter", onPress: () => resolve(true) },
            ],
          );
        });
        if (!proceed) return;
      }

      const steps: FixStep[] = [];

      // De-dup patches in batch mode: prevents repeated apply of identical patch sets.
      const seen = new Set<string>();
      const deduped: Array<{ r: PreflightCheckResult; patch: PreflightPatch }> = [];
      for (const r of items) {
        if (!r.fix?.patch) continue;
        const patch = r.fix.patch;
        const fp = patchFingerprint(patch);
        if (seen.has(fp)) continue;
        seen.add(fp);
        deduped.push({ r, patch });
      }

      for (const { r, patch } of deduped) {
        steps.push({ key: `apply:${r.id}`, title: `Apply: ${r.title}`, status: "pending" });
        if (shouldSyncPatch(patch)) {
          steps.push({ key: `sync:${r.id}`, title: `Sync: ${r.title}`, status: "pending" });
        }
      }
      if (rerunAfterFix) {
        steps.push({ key: "rerun", title: "Re-Run Diagnostics (Verify)", status: "pending" });
      }

      const skipped = Math.max(0, items.filter((r) => !!r.fix?.patch).length - deduped.length);
      setFixModalTitle(label);
      setFixModalSubtitle(`${deduped.length} Fixes${skipped ? ` (skipped ${skipped} dup)` : ""}`);
      setFixSteps(steps);
      setFixStepIndex(0);
      setFixDone(false);
      setFixModalVisible(true);

      let cursor = 0;
      const mark = (idx: number, patch: Partial<FixStep>) => {
        setFixSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
      };

      for (const { r, patch } of deduped) {
        mark(cursor, { status: "running" });
        try {
          await applyPatch(r.title, patch);
          mark(cursor, { status: "done" });
        } catch (e: any) {
          mark(cursor, { status: "failed", message: safeTruncateText(e?.message || "Apply fehlgeschlagen", 160) });
          setFixDone(true);
          return;
        }
        cursor++;

        if (shouldSyncPatch(patch)) {
          setFixStepIndex(cursor);
          mark(cursor, { status: "running" });
          try {
            await syncPatchToGitHub(r.title, patch);
            mark(cursor, { status: "done" });
          } catch (e: any) {
            mark(cursor, { status: "failed", message: safeTruncateText(e?.message || "Sync fehlgeschlagen", 160) });
            setFixDone(true);
            return;
          }
          cursor++;
        }
      }

      if (rerunAfterFix) {
        setFixStepIndex(cursor);
        mark(cursor, { status: "running" });
        try {
          await runDiagnostics({ resetSelection: false, resetHistory: false });
          mark(cursor, { status: "done" });
        } catch (e: any) {
          mark(cursor, { status: "failed", message: safeTruncateText(e?.message || "Verify fehlgeschlagen", 160) });
          setFixDone(true);
          return;
        }
      }

      setFixStepIndex(steps.length);
      setFixDone(true);
      toast?.show?.("Fix applied");
    },
    [applyPatch, projectRef, rerunAfterFix, runDiagnostics, shouldSyncPatch, syncPatchToGitHub, toast],
  );

  const smartFix = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

    const recommended = fixableResults.filter(
      (r) => ((r.status ?? "pass") as Status) === "fail" && !!r.fix?.patch,
    );

    if (!recommended.length) {
      Alert.alert("Nichts zu fixen", "Keine empfohlenen Fixes (Critical) gefunden.");
      return;
    }

    const total = recommended.length;
    const slice = recommended.slice(0, AUTOFIX_MAX);

    if (total > AUTOFIX_MAX) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Smart Fix Limit",
          `Es werden nur ${AUTOFIX_MAX}/${total} empfohlenen Fixes angewendet. Filtere oder führe erneut aus, um weitere anzuwenden.`,
          [
            { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
            { text: `Apply ${AUTOFIX_MAX}`, onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    await applyFixList(slice, "Smart Fix");
  }, [applyFixList, fixableResults]);

  const applySelected = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

    const chosenAll = sortedResults.filter((r) => selected[r.id] && r.fix?.patch);
    if (!chosenAll.length) {
      Alert.alert("Nichts ausgewählt", "Bitte wähle Fixes aus.");
      return;
    }

    if (chosenAll.length > AUTOFIX_MAX) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Zu viele Fixes",
          `Es sind ${chosenAll.length} Fixes ausgewählt, aber maximal ${AUTOFIX_MAX} können auf einmal angewendet werden.\n\nTipp: Nutze Filter (z.B. fail-only), oder führe AutoFix mehrfach aus.`,
          [
            { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
            { text: `Weiter (${AUTOFIX_MAX}/${chosenAll.length})`, onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    const chosen = chosenAll.slice(0, AUTOFIX_MAX);
    await applyFixList(chosen, "Fix Selected");
  }, [applyFixList, projectRef, selected, sortedResults]);

  const autoFix = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

    const baseList = (autoFixScope === "visible" ? visibleResults : fixableResults).filter(
      (r) => !!r.fix?.patch,
    );

    const chosen = baseList.filter((r) => {
      const st = (r.status as Status) ?? "pass";
      if (st === "fail") return true;
      if (autoFixIncludeWarn && st === "warn") return true;
      return false;
    });

    if (!chosen.length) {
      Alert.alert(
        "Nichts zu fixen",
        autoFixIncludeWarn ? "Keine fail/warn Fixes gefunden." : "Keine fail Fixes gefunden.",
      );
      return;
    }

    const slice = chosen.slice(0, AUTOFIX_MAX);

    Alert.alert(
      "AutoFix starten?",
      `Es werden ${slice.length} Fix(es) automatisch angewendet.\nScope: ${autoFixScope}\nIncludes warnings: ${autoFixIncludeWarn ? "ja" : "nein"}\n\nTipp: Mit „Re-Run“ nach dem Fix wird automatisch gegengecheckt.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "AutoFix",
          onPress: async () => {
            await applyFixList(slice, "AutoFix");
          },
        },
      ],
    );
  }, [applyFixList, autoFixIncludeWarn, autoFixScope, fixableResults, projectRef, visibleResults]);

  const applySingle = useCallback(
    (r: PreflightCheckResult) => {
      if (!r.fix?.patch) return;

      // Note: TypeScript does not keep narrowing for r.fix across nested closures.
      // Capture once so we can safely reference inside callbacks.
      const patch = r.fix.patch;

      const canSyncRepo = !!parseOwnerRepo(linkedRepo);
      const syncWouldHelp = shouldSyncPatch(patch);

      const runOne = async (doSync: boolean) => {
        const steps: FixStep[] = [
          { key: "apply", title: "Apply patch (local)", status: "pending" },
          ...(doSync
            ? [{ key: "sync", title: "Sync to GitHub", status: "pending" as FixStepStatus }]
            : []),
          ...(rerunAfterFix
            ? [{ key: "rerun", title: "Re-Run Diagnostics (Verify)", status: "pending" as FixStepStatus }]
            : []),
        ];

        setFixModalTitle("Fix");
        setFixModalSubtitle(r.title);
        setFixSteps(steps);
        setFixStepIndex(0);
        setFixDone(false);
        setFixModalVisible(true);

        setFixSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "running" } : s)));
        try {
          await applyPatch(r.title, patch);
          setFixSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "done" } : s)));
        } catch (e: any) {
          setFixSteps((prev) =>
            prev.map((s, i) =>
              i === 0
                ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Fehler", 160) }
                : s,
            ),
          );
          setFixDone(true);
          return;
        }

        let stepCursor = 1;
        if (doSync) {
          setFixStepIndex(stepCursor);
          setFixSteps((prev) => prev.map((s, i) => (i === stepCursor ? { ...s, status: "running" } : s)));
          try {
            await syncPatchToGitHub(r.title, patch);
            setFixSteps((prev) => prev.map((s, i) => (i === stepCursor ? { ...s, status: "done" } : s)));
          } catch (e: any) {
            setFixSteps((prev) =>
              prev.map((s, i) =>
                i === stepCursor
                  ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Sync fehlgeschlagen", 160) }
                  : s,
              ),
            );
            setFixDone(true);
            return;
          }
          stepCursor++;
        }

        if (rerunAfterFix) {
          setFixStepIndex(stepCursor);
          setFixSteps((prev) => prev.map((s, i) => (i === stepCursor ? { ...s, status: "running" } : s)));
          try {
            await runDiagnostics({ resetSelection: false, resetHistory: false });
            setFixSteps((prev) => prev.map((s, i) => (i === stepCursor ? { ...s, status: "done" } : s)));
          } catch (e: any) {
            setFixSteps((prev) =>
              prev.map((s, i) =>
                i === stepCursor
                  ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Verify fehlgeschlagen", 160) }
                  : s,
              ),
            );
          }
        }

        setFixDone(true);
        setFixStepIndex(steps.length);
        toast?.show?.("Fix applied");
      };

      Alert.alert(
        "Fix anwenden?",
        `${r.title}\n\n${safeTruncateText(r.message ?? "", 240)}${syncWouldHelp ? "\n\nHinweis: Dieser Fix betrifft Repo-Dateien → Sync macht Sinn." : ""}`,
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Preview", onPress: () => openPreview(r.title, patch) },
          { text: "Fix", onPress: () => runOne(false) },
          ...(canSyncRepo ? [{ text: "Fix + Sync", onPress: () => runOne(true) }] : []),
        ],
      );
    },
    [
      applyPatch,
      linkedRepo,
      openPreview,
      rerunAfterFix,
      runDiagnostics,
      shouldSyncPatch,
      syncPatchToGitHub,
      toast,
    ],
  );

  const applyFixListPublic = applyFixList; // naming parity with old hook

  return {
    // state
    history,
    previewVisible,
    setPreviewVisible,
    previewLabel,
    previewEntries,
    setPreviewLabel,
    setPreviewEntries,
    applyBusy,

    // modals
    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    closeFixModal,

    // actions
    setSelected,
    openPreview,
    applyPatch,
    undoLast,
    undoAll,
    applySingle,
    autoFix,
    applySelected,
    smartFix,
    applyIssueFix,
    applyFixList: applyFixListPublic,
  };
}
