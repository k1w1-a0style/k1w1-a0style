import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, Pressable, FlatList } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";
import { splitFullName } from "../utils/repos";
import { getRepoFileText, listRepoBlobPaths } from "../../../infra/github/githubService";
import { MANAGED_WORKFLOWS, normalizeRepoPath } from "../../../infra/github/utils";

type LocalFile = { path: string; content: string };

type DiffItem = {
  path: string;
  status: "same" | "modified" | "localOnly" | "remoteOnly" | "skipped" | "error";
  detail?: string;
};

type PreviewCacheEntry = {
  status: DiffItem["status"];
  local: string;
  remote: string;
  diff: string;
};

function hashText(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function buildLocalFilesFingerprint(files: LocalFile[]) {
  if (!files.length) return "local:empty";
  return files
    .map((file) => {
      const path = normalizeRepoPath(String(file.path || ""));
      const content = String(file.content ?? "");
      return `${path}:${content.length}:${hashText(content)}`;
    })
    .sort()
    .join("|");
}

function statusGlyph(s: DiffItem["status"]) {
  // "Git-like" signals: + = local add, - = remote-only (missing locally), ± = modified
  if (s === "localOnly") return "+";
  if (s === "remoteOnly") return "-";
  if (s === "modified") return "±";
  if (s === "same") return "=";
  if (s === "skipped") return "·";
  return "!";
}

function statusColor(s: DiffItem["status"]) {
  if (s === "localOnly") return theme.palette.success;
  if (s === "remoteOnly") return theme.palette.error;
  if (s === "modified") return theme.palette.warning;
  if (s === "error") return theme.palette.error;
  return theme.palette.text.muted;
}

function safeSliceLines(text: string, maxLines: number) {
  const lines = String(text ?? "").split("\n");
  if (lines.length <= maxLines) return { text: lines.join("\n"), truncated: false, total: lines.length };
  return { text: lines.slice(0, maxLines).join("\n"), truncated: true, total: lines.length };
}

// Small LCS-based line diff. Good enough for UI previews without adding deps.
function unifiedLineDiff(localText: string, remoteText: string, maxLinesOut = 600): string {
  const a = String(localText ?? "").split("\n");
  const b = String(remoteText ?? "").split("\n");

  const n = a.length;
  const m = b.length;

  // Guard for huge files (avoid O(n*m)).
  if (n * m > 200_000) {
    return "(Diff Preview ist zu groß – zeige nur Local/Remote Inhalte an.)";
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m && out.length < maxLinesOut) {
    if (a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(`- ${a[i]}`);
      i++;
    } else {
      out.push(`+ ${b[j]}`);
      j++;
    }
  }
  while (i < n && out.length < maxLinesOut) out.push(`- ${a[i++]}`);
  while (j < m && out.length < maxLinesOut) out.push(`+ ${b[j++]}`);
  if (out.length >= maxLinesOut) out.push("… (gekürzt)");
  return out.join("\n");
}

// Reduce huge diffs by showing only context around changed lines.
function compactUnifiedDiff(diffText: string, ctx = 3, maxOutLines = 260): string {
  const lines = String(diffText ?? "").split("\n");
  // If already small, return as-is.
  if (lines.length <= maxOutLines) return diffText;

  const keep = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i] ?? "";
    const isChange = ln.startsWith("+") || ln.startsWith("-");
    if (isChange) {
      for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) keep.add(j);
    }
    // always keep hunk headers if any
    if (ln.startsWith("@@")) keep.add(i);
  }

  const out: string[] = [];
  let lastKept = -2;
  for (let i = 0; i < lines.length; i++) {
    if (!keep.has(i)) continue;
    if (i > lastKept + 1) out.push("…");
    out.push(lines[i]);
    lastKept = i;
    if (out.length >= maxOutLines) {
      out.push("… (gekürzt)");
      break;
    }
  }

  // If we couldn't detect changes, just cut head.
  if (!out.length) {
    return lines.slice(0, maxOutLines).join("\n") + "\n… (gekürzt)";
  }
  return out.join("\n");
}

function diffLineStyle(line: string) {
  if (line.startsWith("+")) return { color: theme.palette.success };
  if (line.startsWith("-")) return { color: theme.palette.error };
  if (line.startsWith("@@")) return { color: theme.palette.text.muted };
  if (line.startsWith("…")) return { color: theme.palette.text.muted };
  return { color: theme.palette.text.secondary };
}

export function LocalRemoteDiffSection(props: {
  activeRepo: string | null;
  activeBranch: string | null;
  projectFiles: LocalFile[];
  onPushSelected?: (paths: string[]) => void;
}) {
  const { activeRepo, activeBranch, projectFiles, onPushSelected } = props;

  const parsed = useMemo(() => (activeRepo ? splitFullName(activeRepo) : null), [activeRepo]);
  const branch = useMemo(() => (activeBranch || "").trim(), [activeBranch]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DiffItem[]>([]);
  const [note, setNote] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [inlineMode, setInlineMode] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const genRef = useRef(0);
  const previewReqRef = useRef(0);

  const previewCacheRef = useRef(new Map<string, PreviewCacheEntry>());
  const [inlineOpenPath, setInlineOpenPath] = useState<string | null>(null);
  const [inlineOpenAll, setInlineOpenAll] = useState(false);
  const [inlineLoadingPath, setInlineLoadingPath] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState<string>("");
  const [previewStatus, setPreviewStatus] = useState<DiffItem["status"]>("same");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLocal, setPreviewLocal] = useState<string>("");
  const [previewRemote, setPreviewRemote] = useState<string>("");
  const [previewDiff, setPreviewDiff] = useState<string>("");

  const local = useMemo(() => {
    const list = Array.isArray(projectFiles) ? projectFiles : [];
    return list
      .filter((f) => f && typeof f.path === "string")
      .map((f) => ({ path: String(f.path), content: String((f as any).content ?? "") }));
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

  const resetContextState = useCallback(() => {
    setItems([]);
    setNote("");
    setLoading(false);
    setSelected({});
    setInlineOpenPath(null);
    setInlineOpenAll(false);
    setInlineLoadingPath(null);
    setPreviewOpen(false);
    setPreviewPath("");
    setPreviewStatus("same");
    setPreviewLoading(false);
    setPreviewLocal("");
    setPreviewRemote("");
    setPreviewDiff("");
    previewCacheRef.current.clear();
  }, []);

  const invalidateStaleTruth = useCallback((staleNote?: string) => {
    invalidateAsyncState();
    loadedTruthKeyRef.current = null;
    resetContextState();
    if (staleNote) setNote(staleNote);
  }, [invalidateAsyncState, resetContextState]);

  const load = useCallback(async () => {
    if (!parsed) {
      loadedTruthKeyRef.current = null;
      resetContextState();
      setNote("Kein Repo gewählt.");
      return;
    }
    if (!local.length) {
      loadedTruthKeyRef.current = null;
      resetContextState();
      setNote("Keine lokalen Projektdateien gefunden.");
      return;
    }

    invalidateAsyncState();
    const myGen = genRef.current;
    setLoading(true);
    setItems([]);
    setNote("");
    setSelected({});
    setInlineOpenPath(null);
    setInlineOpenAll(false);
    setInlineLoadingPath(null);
    setPreviewOpen(false);
    setPreviewPath("");
    setPreviewStatus("same");
    setPreviewLoading(false);
    setPreviewLocal("");
    setPreviewRemote("");
    setPreviewDiff("");
    previewCacheRef.current.clear();

    // Safety: keep API calls reasonable.
    const MAX = 60;
    const slice = local.slice(0, MAX);
    if (local.length > MAX) {
      setNote(`Es werden nur die ersten ${MAX} lokalen Dateien geprüft (Rate-Limit Schutz).`);
    }

    const results: DiffItem[] = [];
    const localPaths = new Set<string>();
    for (const f of slice) {
      if (myGen !== genRef.current) return;

      const rawPath = String(f.path || "").trim();
      if (!rawPath) continue;
      const path = normalizeRepoPath(rawPath);
      localPaths.add(path);

      // Keep the same behavior as push: unmanaged workflows are ignored.
      if (path.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(path)) {
        results.push({ path, status: "skipped", detail: "unmanaged workflow" });
        continue;
      }

      try {
        const remote = await getRepoFileText({ owner: parsed.owner, repo: parsed.repo, path, ref: branch });
        const same = remote === String(f.content ?? "");
        results.push({ path, status: same ? "same" : "modified" });
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          results.push({ path, status: "localOnly" });
        } else {
          results.push({ path, status: "error", detail: msg.slice(0, 140) });
        }
      }
    }

    // Remote-only: files that exist online but not locally.
    try {
      const remotePaths = await listRepoBlobPaths({ owner: parsed.owner, repo: parsed.repo, ref: branch });
      const remoteSet = new Set(remotePaths);
      let added = 0;
      const MAX_REMOTE_ONLY = 120;
      for (const rp of remoteSet) {
        if (myGen !== genRef.current) return;
        if (rp.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(rp)) continue;
        if (!localPaths.has(rp)) {
          results.push({ path: rp, status: "remoteOnly" });
          added++;
          if (added >= MAX_REMOTE_ONLY) break;
        }
      }
      if (remoteSet.size > localPaths.size && added >= MAX_REMOTE_ONLY) {
        setNote((prev) => (prev ? prev : `Remote-only ist auf ${MAX_REMOTE_ONLY} Einträge begrenzt (Übersicht + Rate-Limit Schutz).`));
      }
    } catch (e: any) {
      // ignore; remote-only may be unavailable on some tokens or rate-limits
    }

    if (myGen !== genRef.current) return;
    loadedTruthKeyRef.current = truthKey;
    setItems(results);
    // Default selection: only pushable changes (modified + localOnly)
    const nextSel: Record<string, boolean> = {};
    for (const r of results) {
      if (r.status === "modified" || r.status === "localOnly") nextSel[r.path] = true;
    }
    setSelected(nextSel);
    setLoading(false);
  }, [parsed, local, branch, invalidateAsyncState, resetContextState, truthKey]);

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
  }, [contextKey, localFingerprint, truthKey, invalidateAsyncState, invalidateStaleTruth, resetContextState]);

  const summary = useMemo(() => {
    const c = (s: DiffItem["status"]) => items.filter((i) => i.status === s).length;
    return {
      same: c("same"),
      modified: c("modified"),
      localOnly: c("localOnly"),
      remoteOnly: c("remoteOnly"),
      skipped: c("skipped"),
      error: c("error"),
      total: items.length,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    if (showAll) return items;
    return items.filter((i) => i.status !== "same" && i.status !== "skipped");
  }, [items, showAll]);

  const localMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of local) m.set(normalizeRepoPath(String(f.path || "")), String((f as any)?.content ?? ""));
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
        if (requestId !== previewReqRef.current || previewTruthKey !== truthKey) return false;
        updater();
        return true;
      };

      commitPreviewState(() => {
        if (!opts?.silent) setPreviewOpen(true);
        setPreviewPath(p);
        setPreviewStatus(it.status);
        setPreviewLoading(true);
        setPreviewLocal("");
        setPreviewRemote("");
        setPreviewDiff("");
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
          setPreviewLocal(localText);
          setPreviewRemote(remoteText);
          setPreviewDiff(diffText);
          previewCacheRef.current.set(getPreviewCacheKey(p), {
            status: it.status,
            local: localText,
            remote: remoteText,
            diff: diffText,
          });
        });
      } finally {
        commitPreviewState(() => {
          setPreviewLoading(false);
        });
      }
    },
    [parsed, branch, localMap, truthKey, getPreviewCacheKey],
  );

  const pushablePaths = useMemo(() => {
    return visibleItems
      .filter((i) => i.status === "modified" || i.status === "localOnly")
      .map((i) => i.path);
  }, [visibleItems]);

  const selectedCount = useMemo(() => {
    return Object.entries(selected)
      .filter(([k, v]) => !!v && pushablePaths.includes(k))
      .length;
  }, [selected, pushablePaths]);

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

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Diff Lokal ↔ Online</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {loading ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
          <TouchableOpacity
            testID="local-remote-diff-refresh"
            style={styles.iconBtn}
            onPress={load}
            disabled={!parsed || loading}
          >
            <Ionicons
              name="refresh"
              size={18}
              color={parsed ? theme.palette.primary : theme.palette.text.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18 }}>
        {activeRepo ? `${activeRepo}@${branch}` : "Repo wählen"}
        {local.length ? ` • Lokal: ${local.length} Dateien` : ""}
      </Text>

      {!!note ? (
        <Text style={{ fontSize: 11, marginTop: 8, color: theme.palette.text.muted, lineHeight: 16 }}>
          {note}
        </Text>
      ) : null}

      {items.length ? (
        <Text style={{ fontSize: 12, marginTop: 10, color: theme.palette.text.secondary, lineHeight: 18 }}>
          ✅ {summary.same} • ✏️ {summary.modified} • ➕ {summary.localOnly} • ⬇️ {summary.remoteOnly} • ⏭️ {summary.skipped} • ⚠️ {summary.error}
        </Text>
      ) : (
        <Text style={{ fontSize: 12, marginTop: 10, color: theme.palette.text.secondary, lineHeight: 18 }}>
          Drück Refresh für einen Vergleich (lokale Dateien gegen GitHub Datei-Inhalt).
        </Text>
      )}

	      <FlatList
	        data={visibleItems.slice(0, 24)}
	        keyExtractor={(i) => `${i.status}:${i.path}`}
	        style={{ marginTop: 12 }}
	        stickyHeaderIndices={[0]}
	        ListHeaderComponent={
	          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4, paddingBottom: 10, backgroundColor: theme.palette.card }}>
	            <TouchableOpacity
	              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	              onPress={() => {
	                setInlineMode((v) => !v);
	                collapseAllInline();
	              }}
	              disabled={!items.length}
	            >
	              <Ionicons
	                name={inlineMode ? "git-compare-outline" : "open-outline"}
	                size={14}
	                color={items.length ? theme.palette.text.secondary : theme.palette.text.muted}
	              />
	              <Text style={{ fontSize: 12, color: items.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
	                {inlineMode ? "Inline" : "Modal"}
	              </Text>
	            </TouchableOpacity>

	            <TouchableOpacity
	              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	              onPress={expandAllInline}
	              disabled={!items.length || !inlineMode}
	            >
	              <Ionicons
	                name="add-circle-outline"
	                size={14}
	                color={items.length && inlineMode ? theme.palette.text.secondary : theme.palette.text.muted}
	              />
	              <Text style={{ fontSize: 12, color: items.length && inlineMode ? theme.palette.text.secondary : theme.palette.text.muted }}>
	                Expand
	              </Text>
	            </TouchableOpacity>

	            <TouchableOpacity
	              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	              onPress={collapseAllInline}
	              disabled={!items.length || !inlineMode}
	            >
	              <Ionicons
	                name="remove-circle-outline"
	                size={14}
	                color={items.length && inlineMode ? theme.palette.text.secondary : theme.palette.text.muted}
	              />
	              <Text style={{ fontSize: 12, color: items.length && inlineMode ? theme.palette.text.secondary : theme.palette.text.muted }}>
	                Collapse
	              </Text>
	            </TouchableOpacity>

	            <TouchableOpacity
	              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	              onPress={() => setShowAll((v) => !v)}
	              disabled={!items.length}
	            >
	              <Ionicons
	                name={showAll ? "eye-off-outline" : "eye-outline"}
	                size={14}
	                color={items.length ? theme.palette.text.secondary : theme.palette.text.muted}
	              />
	              <Text style={{ fontSize: 12, color: items.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
	                {showAll ? "Nur Änderungen" : "Alle"}
	              </Text>
	            </TouchableOpacity>

	            <TouchableOpacity
	              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	              onPress={() => setAll(true)}
	              disabled={!items.length || !pushablePaths.length}
	            >
	              <Ionicons
	                name="checkbox-outline"
	                size={14}
	                color={items.length && pushablePaths.length ? theme.palette.text.secondary : theme.palette.text.muted}
	              />
	              <Text style={{ fontSize: 12, color: items.length && pushablePaths.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
	                Alle Änderungen
	              </Text>
	            </TouchableOpacity>

	            <TouchableOpacity
	              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	              onPress={() => setAll(false)}
	              disabled={!items.length || !pushablePaths.length}
	            >
	              <Ionicons
	                name="square-outline"
	                size={14}
	                color={items.length && pushablePaths.length ? theme.palette.text.secondary : theme.palette.text.muted}
	              />
	              <Text style={{ fontSize: 12, color: items.length && pushablePaths.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
	                Keine
	              </Text>
	            </TouchableOpacity>

	            <TouchableOpacity
	              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	              onPress={() => {
	                const paths = Object.entries(selected)
	                  .filter(([, v]) => !!v)
	                  .map(([k]) => k);
	                if (!paths.length) {
	                  Alert.alert("⚠️", "Keine Dateien ausgewählt.");
	                  return;
	                }
	                onPushSelected?.(paths);
	              }}
	              disabled={!items.length || !selectedCount || !onPushSelected}
	            >
	              <Ionicons
	                name="cloud-upload-outline"
	                size={14}
	                color={items.length && selectedCount && onPushSelected ? theme.palette.primary : theme.palette.text.muted}
	              />
	              <Text style={{ fontSize: 12, color: items.length && selectedCount && onPushSelected ? theme.palette.text.secondary : theme.palette.text.muted }}>
	                Push ({selectedCount})
	              </Text>
	            </TouchableOpacity>

	            <TouchableOpacity
	              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	              onPress={async () => {
	                const text = items.map((i) => `${statusGlyph(i.status)} ${i.path}`).join("\n");
	                await Clipboard.setStringAsync(text);
	              }}
	              disabled={!items.length}
	            >
	              <Ionicons
	                name="copy-outline"
	                size={14}
	                color={items.length ? theme.palette.text.secondary : theme.palette.text.muted}
	              />
	              <Text style={{ fontSize: 12, color: items.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
	                Liste
	              </Text>
	            </TouchableOpacity>

	            {items.length > 24 ? (
	              <TouchableOpacity
	                style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
	                onPress={() => {
	                  Alert.alert(
	                    "Lokale vs Online Diff",
	                    items.map((i) => `${statusGlyph(i.status)} ${i.path}${i.detail ? ` (${i.detail})` : ""}`).join("\n"),
	                  );
	                }}
	              >
	                <Ionicons name="list-outline" size={14} color={theme.palette.text.secondary} />
	                <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>Alle</Text>
	              </TouchableOpacity>
	            ) : null}
	          </View>
	        }
	        renderItem={({ item: i }) => {
	          const pushable = i.status === "modified" || i.status === "localOnly";
	          const checked = !!selected[i.path];
	          const isOpen = inlineMode && (inlineOpenAll || inlineOpenPath === i.path);
	          const cached = previewCacheRef.current.get(getPreviewCacheKey(i.path));
	          const needsLoad = inlineMode && isOpen && !cached;
	          return (
	            <View style={{ marginBottom: 2 }}>
	              <Pressable
	                onPress={async () => {
	                  if (!inlineMode) {
	                    openPreview(i);
	                    return;
	                  }

	                  const p = i.path;
	                  if (!inlineOpenAll) {
	                    if (inlineOpenPath === p) {
	                      setInlineOpenPath(null);
	                      return;
	                    }
	                    setInlineOpenPath(p);
	                  }

	                  const c = previewCacheRef.current.get(getPreviewCacheKey(p));
	                  if (!c) {
	                    setInlineLoadingPath(p);
	                    try {
	                      await openPreview(i, { silent: true });
	                    } finally {
	                      setInlineLoadingPath(null);
	                    }
	                  }
	                }}
	                style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 6 }}
	              >
	                <Pressable
	                  onPress={() => {
	                    if (pushable) toggle(i.path);
	                    else openPreview(i);
	                  }}
	                  style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
	                >
	                  {pushable ? (
	                    <Ionicons
	                      name={checked ? "checkbox" : "square-outline"}
	                      size={18}
	                      color={checked ? theme.palette.primary : theme.palette.text.muted}
	                    />
	                  ) : (
	                    <Ionicons name="search-outline" size={16} color={theme.palette.text.muted} />
	                  )}
	                </Pressable>

	                <Text style={{ width: 18, textAlign: "center", color: statusColor(i.status), fontWeight: "900" }}>
	                  {statusGlyph(i.status)}
	                </Text>

	                <View style={{ flex: 1 }}>
	                  <Text style={{ fontSize: 12, color: theme.palette.text.secondary }} numberOfLines={1}>
	                    {i.path}
	                  </Text>
	                  {!!i.detail ? (
	                    <Text style={{ fontSize: 11, color: theme.palette.text.muted }} numberOfLines={1}>
	                      {i.detail}
	                    </Text>
	                  ) : null}
	                </View>

	                {pushable ? (
	                  <Text style={{ color: theme.palette.text.muted, fontSize: 11 }}>push</Text>
	                ) : i.status === "remoteOnly" ? (
	                  <Text style={{ color: theme.palette.text.muted, fontSize: 11 }}>pull</Text>
	                ) : null}
	              </Pressable>

	              {isOpen ? (
	                <View style={{ marginLeft: 30, marginBottom: 8, marginTop: 4, borderLeftWidth: 2, borderLeftColor: theme.palette.border, paddingLeft: 10 }}>
	                  {inlineLoadingPath === i.path ? (
	                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
	                      <ActivityIndicator size="small" />
	                      <Text style={{ color: theme.palette.text.muted, fontSize: 12 }}>Lade Diff…</Text>
	                    </View>
	                  ) : (
	                    <View style={{ borderWidth: 1, borderColor: theme.palette.border, borderRadius: 10, padding: 10, backgroundColor: theme.palette.backgroundDark }}>
	                      {needsLoad ? (
	                        <TouchableOpacity
	                          style={[styles.button, { paddingVertical: 8 }]}
	                          onPress={async () => {
	                            setInlineLoadingPath(i.path);
	                            try {
	                              await openPreview(i, { silent: true });
	                            } finally {
	                              setInlineLoadingPath(null);
	                            }
	                          }}
	                        >
	                          <Ionicons name="download-outline" size={16} color={theme.palette.text.secondary} />
	                          <Text style={styles.buttonText}>Diff laden</Text>
	                        </TouchableOpacity>
	                      ) : null}

	                      {(previewCacheRef.current.get(getPreviewCacheKey(i.path))?.diff || (needsLoad ? "" : "(keine Vorschau)"))
	                        .split("\n")
	                        .slice(0, 220)
	                        .map((ln, idx) => (
	                          <Text key={idx} style={[{ fontFamily: "monospace", fontSize: 11, lineHeight: 16 }, diffLineStyle(ln)]}>
	                            {ln}
	                          </Text>
	                        ))}
	                    </View>
	                  )}

	                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
	                    <TouchableOpacity
	                      style={[styles.button, { flex: 1, paddingVertical: 8 }]}
	                      onPress={async () => {
	                        const cached2 = previewCacheRef.current.get(getPreviewCacheKey(i.path));
	                        const t = cached2?.diff || "";
	                        await Clipboard.setStringAsync(t);
	                        Alert.alert("✅", "Diff kopiert.");
	                      }}
	                    >
	                      <Ionicons name="copy-outline" size={16} color={theme.palette.text.secondary} />
	                      <Text style={styles.buttonText}>Diff kopieren</Text>
	                    </TouchableOpacity>

	                    <TouchableOpacity style={[styles.button, { flex: 1, paddingVertical: 8 }]} onPress={() => openPreview(i)}>
	                      <Ionicons name="open-outline" size={16} color={theme.palette.text.secondary} />
	                      <Text style={styles.buttonText}>Details</Text>
	                    </TouchableOpacity>
	                  </View>
	                </View>
	              ) : null}
	            </View>
	          );
	        }}
	        ListFooterComponent={
	          visibleItems.length > 24 ? (
	            <Text style={{ fontSize: 11, color: theme.palette.text.muted, marginTop: 6 }}>
	              +{visibleItems.length - 24} weitere…
	            </Text>
	          ) : null
	        }
	      />

      <Modal visible={previewOpen} animationType="slide" transparent onRequestClose={() => setPreviewOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 14, justifyContent: "center" }}>
          <View style={{ backgroundColor: theme.palette.card, borderRadius: 14, padding: 12, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: theme.palette.text.primary, fontWeight: "700" }}>
                  {previewPath}
                </Text>
                <Text style={{ color: theme.palette.text.muted, fontSize: 12 }}>
                  Status: {statusGlyph(previewStatus)} {previewStatus}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewOpen(false)}>
                <Ionicons name="close" size={20} color={theme.palette.text.secondary} />
              </TouchableOpacity>
            </View>

            {previewLoading ? (
              <View style={{ paddingVertical: 18, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: theme.palette.text.muted, fontSize: 12 }}>Lade Diff…</Text>
              </View>
            ) : (
              <ScrollView style={{ marginTop: 10 }}>
                {!!previewDiff ? (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: theme.palette.text.secondary, fontSize: 12, marginBottom: 6 }}>
                      Unified Diff
                    </Text>
                    <View style={{ borderWidth: 1, borderColor: theme.palette.border, borderRadius: 10, padding: 10 }}>
                      {safeSliceLines(previewDiff, 700).text.split("\n").map((ln, idx) => (
                        <Text key={idx} style={[{ fontFamily: "monospace", fontSize: 11, lineHeight: 16 }, diffLineStyle(ln)]}>
                          {ln}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.palette.text.secondary, fontSize: 12, marginBottom: 6 }}>Local</Text>
                    <View style={{ borderWidth: 1, borderColor: theme.palette.border, borderRadius: 10, padding: 10 }}>
                      <Text style={{ color: theme.palette.text.primary, fontFamily: "monospace", fontSize: 11 }}>
                        {safeSliceLines(previewLocal, 250).text || "(leer)"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.palette.text.secondary, fontSize: 12, marginBottom: 6 }}>Remote</Text>
                    <View style={{ borderWidth: 1, borderColor: theme.palette.border, borderRadius: 10, padding: 10 }}>
                      <Text style={{ color: theme.palette.text.primary, fontFamily: "monospace", fontSize: 11 }}>
                        {safeSliceLines(previewRemote, 250).text || "(leer)"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.button, { flex: 1 }]}
                    onPress={async () => {
                      const text = previewDiff || `LOCAL\n${previewLocal}\n\nREMOTE\n${previewRemote}`;
                      await Clipboard.setStringAsync(text);
                      Alert.alert("✅", "In Zwischenablage kopiert.");
                    }}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.palette.text.secondary} />
                    <Text style={styles.buttonText}>Kopieren</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={() => setPreviewOpen(false)}>
                    <Ionicons name="checkmark" size={16} color={theme.palette.text.secondary} />
                    <Text style={styles.buttonText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
