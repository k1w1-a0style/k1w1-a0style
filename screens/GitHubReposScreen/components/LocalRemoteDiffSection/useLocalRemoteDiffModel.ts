import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { splitFullName } from "../../utils/repos";
import { getRepoFileText, listRepoBlobPaths } from "../../../../infra/github/githubService";
import { MANAGED_WORKFLOWS, normalizeRepoPath } from "../../../../infra/github/utils";
import { getErrorMessage } from "../../hooks/githubReposScreenErrorHelpers";
import { buildLocalFilesFingerprint } from "./fingerprint";
import { compactUnifiedDiff, unifiedLineDiff } from "./diffAlgorithms";
import { DiffItem, DiffPreviewState, DiffSummary, LocalFile, PreviewCacheEntry } from "./types";

type Params = {
  activeRepo: string | null;
  activeBranch: string | null;
  projectFiles: LocalFile[];
};

const INITIAL_PREVIEW: DiffPreviewState = {
  open: false,
  path: "",
  status: "same",
  loading: false,
  local: "",
  remote: "",
  diff: "",
};

export function useLocalRemoteDiffModel(params: Params) {
  const { activeRepo, activeBranch, projectFiles } = params;

  const parsed = useMemo(() => (activeRepo ? splitFullName(activeRepo) : null), [activeRepo]);
  const branch = useMemo(() => (activeBranch || "").trim(), [activeBranch]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DiffItem[]>([]);
  const [note, setNote] = useState<string>("");
  const [partialReason, setPartialReason] = useState<string | null>(null);
  const [countsAreLowerBounds, setCountsAreLowerBounds] = useState(false);
  const [localComparedCountsAreLowerBounds, setLocalComparedCountsAreLowerBounds] = useState(false);
  const [remoteOnlyCountIsLowerBound, setRemoteOnlyCountIsLowerBound] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [inlineMode, setInlineMode] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const genRef = useRef(0);
  const previewReqRef = useRef(0);
  const mountedRef = useRef(true);

  const previewCacheRef = useRef(new Map<string, PreviewCacheEntry>());
  const [inlineOpenPath, setInlineOpenPath] = useState<string | null>(null);
  const [inlineOpenAll, setInlineOpenAll] = useState(false);
  const [inlineLoadingPath, setInlineLoadingPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<DiffPreviewState>(INITIAL_PREVIEW);

  const local = useMemo(() => {
    const list = Array.isArray(projectFiles) ? projectFiles : [];
    return list
      .filter((f) => f && typeof f.path === "string")
      .map((f) => ({ path: String(f.path), content: String(f.content ?? "") }));
  }, [projectFiles]);

  const contextKey = useMemo(() => `${activeRepo ?? ""}@@${branch}`, [activeRepo, branch]);
  const localFingerprint = useMemo(() => buildLocalFilesFingerprint(local), [local]);
  const truthKey = useMemo(() => `${contextKey}::${localFingerprint}`, [contextKey, localFingerprint]);

  const loadedTruthKeyRef = useRef<string | null>(null);
  const lastContextKeyRef = useRef(contextKey);
  const lastLocalFingerprintRef = useRef(localFingerprint);

  const getPreviewCacheKey = useCallback((path: string) => `${truthKey}::${normalizeRepoPath(path)}`, [truthKey]);

  const invalidateAsyncState = useCallback(() => {
    genRef.current += 1;
    previewReqRef.current += 1;
  }, []);

  const commitIfMounted = useCallback((updater: () => void) => {
    if (!mountedRef.current) return false;
    updater();
    return true;
  }, []);

  const resetContextState = useCallback(() => {
    setItems([]);
    setNote("");
    setPartialReason(null);
    setCountsAreLowerBounds(false);
    setLocalComparedCountsAreLowerBounds(false);
    setRemoteOnlyCountIsLowerBound(false);
    setLoading(false);
    setSelected({});
    setInlineOpenPath(null);
    setInlineOpenAll(false);
    setInlineLoadingPath(null);
    setPreview(INITIAL_PREVIEW);
    previewCacheRef.current.clear();
  }, []);

  const invalidateStaleTruth = useCallback(
    (staleNote?: string) => {
      invalidateAsyncState();
      loadedTruthKeyRef.current = null;
      resetContextState();
      if (staleNote) setNote(staleNote);
    },
    [invalidateAsyncState, resetContextState],
  );

  const load = useCallback(async () => {
    if (!parsed) {
      loadedTruthKeyRef.current = null;
      resetContextState();
      commitIfMounted(() => {
        setNote("Kein Repo gewählt.");
      });
      return;
    }
    if (!local.length) {
      loadedTruthKeyRef.current = null;
      resetContextState();
      commitIfMounted(() => {
        setNote("Keine lokalen Projektdateien gefunden.");
      });
      return;
    }

    invalidateAsyncState();
    const myGen = genRef.current;
    commitIfMounted(() => {
      setLoading(true);
      setItems([]);
      setNote("");
      setPartialReason(null);
      setCountsAreLowerBounds(false);
      setLocalComparedCountsAreLowerBounds(false);
      setRemoteOnlyCountIsLowerBound(false);
      setSelected({});
      setInlineOpenPath(null);
      setInlineOpenAll(false);
      setInlineLoadingPath(null);
      setPreview(INITIAL_PREVIEW);
      previewCacheRef.current.clear();
    });

    const MAX = 60;
    const slice = local.slice(0, MAX);
    const localSliceIsTruncated = local.length > MAX;
    if (localSliceIsTruncated) {
      commitIfMounted(() => {
        setNote(`Es werden nur die ersten ${MAX} lokalen Dateien geprüft (Rate-Limit Schutz).`);
        setPartialReason(
          `Vergleich ist teilweise: ${MAX}/${local.length} lokale Dateien geprüft. Abweichungen wurden nur im Teilumfang geprüft; kein Full-Sync-Schluss möglich.`,
        );
        setCountsAreLowerBounds(true);
        setLocalComparedCountsAreLowerBounds(true);
        setRemoteOnlyCountIsLowerBound(false);
      });
    }

    const results: DiffItem[] = [];
    const localPaths = new Set<string>();
    for (const f of slice) {
      if (myGen !== genRef.current) return;

      const rawPath = String(f.path || "").trim();
      if (!rawPath) continue;
      const path = normalizeRepoPath(rawPath);
      localPaths.add(path);

      if (path.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(path)) {
        results.push({ path, status: "skipped", detail: "unmanaged workflow" });
        continue;
      }

      try {
        const remote = await getRepoFileText({ owner: parsed.owner, repo: parsed.repo, path, ref: branch });
        const same = remote === String(f.content ?? "");
        results.push({ path, status: same ? "same" : "modified" });
      } catch (e: unknown) {
        const msg = getErrorMessage(e, "");
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          results.push({ path, status: "localOnly" });
        } else {
          results.push({ path, status: "error", detail: msg.slice(0, 140) });
        }
      }
    }

    try {
      const remotePaths = await listRepoBlobPaths({ owner: parsed.owner, repo: parsed.repo, ref: branch });
      const remoteSet = new Set(remotePaths);
      let added = 0;
      const MAX_REMOTE_ONLY = 120;
      for (const rp of remoteSet) {
        if (typeof rp !== "string") continue;
        if (myGen !== genRef.current) return;
        if (rp.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(rp)) continue;
        if (!localPaths.has(rp)) {
          results.push({ path: rp, status: "remoteOnly" });
          added++;
          if (added >= MAX_REMOTE_ONLY) break;
        }
      }
      const remoteOnlyListIsTruncated = remoteSet.size > localPaths.size && added >= MAX_REMOTE_ONLY;
      if (remoteOnlyListIsTruncated) {
        commitIfMounted(() => {
          setNote((prev) =>
            prev ? prev : `Remote-only ist auf ${MAX_REMOTE_ONLY} Einträge begrenzt (Übersicht + Rate-Limit Schutz).`,
          );
          setPartialReason((prev) => {
            if (prev) return `${prev} Remote-only Liste wurde zusätzlich gekürzt.`;
            return "Vergleich ist teilweise: Remote-only Liste wurde gekürzt.";
          });
          setCountsAreLowerBounds(true);
          setRemoteOnlyCountIsLowerBound(!localSliceIsTruncated);
        });
      }
    } catch {
      // ignore; remote-only may be unavailable on some tokens or rate-limits
    }

    if (myGen !== genRef.current) return;
    loadedTruthKeyRef.current = truthKey;
    commitIfMounted(() => {
      setItems(results);
      const nextSel: Record<string, boolean> = {};
      for (const r of results) {
        if (r.status === "modified" || r.status === "localOnly") nextSel[r.path] = true;
      }
      setSelected(nextSel);
      setLoading(false);
    });
  }, [branch, commitIfMounted, invalidateAsyncState, local, parsed, resetContextState, truthKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      invalidateAsyncState();
    };
  }, [invalidateAsyncState]);

  useEffect(() => {
    if (lastContextKeyRef.current !== contextKey) {
      lastContextKeyRef.current = contextKey;
      lastLocalFingerprintRef.current = localFingerprint;
      loadedTruthKeyRef.current = null;
      invalidateAsyncState();
      resetContextState();
      return;
    }

    if (lastLocalFingerprintRef.current === localFingerprint) return;
    lastLocalFingerprintRef.current = localFingerprint;

    if (!loadedTruthKeyRef.current || loadedTruthKeyRef.current === truthKey) return;

    invalidateStaleTruth("Lokale Dateien wurden geändert. Vergleich neu laden.");
  }, [contextKey, invalidateAsyncState, invalidateStaleTruth, localFingerprint, resetContextState, truthKey]);

  const summary = useMemo<DiffSummary>(() => {
    const c = (s: DiffItem["status"]) => items.filter((i) => i.status === s).length;
    const isPartial = !!partialReason;
    return {
      same: c("same"),
      modified: c("modified"),
      localOnly: c("localOnly"),
      remoteOnly: c("remoteOnly"),
      skipped: c("skipped"),
      error: c("error"),
      total: items.length,
      isPartial,
      countsAreLowerBounds: isPartial && countsAreLowerBounds,
      localComparedCountsAreLowerBounds: isPartial && localComparedCountsAreLowerBounds,
      remoteOnlyCountIsLowerBound: isPartial && remoteOnlyCountIsLowerBound,
      partialReason,
    };
  }, [items, partialReason, countsAreLowerBounds, localComparedCountsAreLowerBounds, remoteOnlyCountIsLowerBound]);

  const visibleItems = useMemo(() => {
    if (showAll) return items;
    return items.filter((i) => i.status !== "same" && i.status !== "skipped");
  }, [items, showAll]);

  const localMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of local) m.set(normalizeRepoPath(String(f.path || "")), String(f.content ?? ""));
    return m;
  }, [local]);

  const openPreview = useCallback(
    async (it: DiffItem, opts?: { silent?: boolean }) => {
      if (!parsed) return;
      const p = normalizeRepoPath(it.path);
      if (!p) return;

      const requestId = ++previewReqRef.current;
      const previewTruthKey = truthKey;
      const commitPreviewState = (updater: () => void) => {
        if (!mountedRef.current || requestId !== previewReqRef.current || previewTruthKey !== truthKey) return false;
        updater();
        return true;
      };

      commitPreviewState(() => {
        setPreview((prev) => ({
          ...prev,
          open: opts?.silent ? prev.open : true,
          path: p,
          status: it.status,
          loading: true,
          local: "",
          remote: "",
          diff: "",
        }));
      });

      try {
        const localText = localMap.get(p) ?? "";
        let remoteText = "";

        if (it.status !== "localOnly") {
          try {
            remoteText = await getRepoFileText({ owner: parsed.owner, repo: parsed.repo, path: p, ref: branch });
          } catch {
            remoteText = "";
          }
        }

        let diffText = "";
        if (it.status === "modified") {
          const raw = unifiedLineDiff(localText, remoteText);
          diffText = compactUnifiedDiff(raw);
        } else if (it.status === "localOnly") {
          diffText = "(Nur lokal vorhanden)\n+ Datei wird beim Push erstellt.";
        } else if (it.status === "remoteOnly") {
          diffText = "(Nur online vorhanden)\n- Datei fehlt lokal. Pull würde sie holen.";
        }

        commitPreviewState(() => {
          setPreview((prev) => ({
            ...prev,
            path: p,
            status: it.status,
            local: localText,
            remote: remoteText,
            diff: diffText,
          }));
          previewCacheRef.current.set(getPreviewCacheKey(p), {
            status: it.status,
            local: localText,
            remote: remoteText,
            diff: diffText,
          });
        });
      } finally {
        commitPreviewState(() => {
          setPreview((prev) => ({ ...prev, loading: false }));
        });
      }
    },
    [branch, getPreviewCacheKey, localMap, parsed, truthKey],
  );

  const pushablePaths = useMemo(
    () => visibleItems.filter((i) => i.status === "modified" || i.status === "localOnly").map((i) => i.path),
    [visibleItems],
  );

  const selectedCount = useMemo(
    () => Object.entries(selected).filter(([k, v]) => !!v && pushablePaths.includes(k)).length,
    [pushablePaths, selected],
  );

  const toggle = useCallback((path: string) => {
    setSelected((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const setAll = useCallback(
    (on: boolean) => {
      const next: Record<string, boolean> = {};
      for (const p of pushablePaths) next[p] = on;
      setSelected(next);
    },
    [pushablePaths],
  );

  const collapseAllInline = useCallback(() => {
    setInlineOpenAll(false);
    setInlineOpenPath(null);
  }, []);

  const expandAllInline = useCallback(() => {
    if (!inlineMode) return;
    setInlineOpenAll(true);
    setInlineOpenPath(null);
  }, [inlineMode]);

  const closePreview = useCallback(() => {
    setPreview((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    parsed,
    branch,
    local,
    loading,
    note,
    items,
    summary,
    visibleItems,
    showAll,
    inlineMode,
    selected,
    selectedCount,
    pushablePaths,
    inlineOpenPath,
    inlineOpenAll,
    inlineLoadingPath,
    preview,
    previewCacheRef,
    getPreviewCacheKey,
    setShowAll,
    setInlineMode,
    setInlineOpenPath,
    setInlineOpenAll,
    setInlineLoadingPath,
    toggle,
    setAll,
    collapseAllInline,
    expandAllInline,
    closePreview,
    load,
    openPreview,
  };
}
