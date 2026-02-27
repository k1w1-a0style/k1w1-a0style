import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, Pressable } from "react-native";
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

export function LocalRemoteDiffSection(props: {
  activeRepo: string | null;
  activeBranch: string | null;
  projectFiles: LocalFile[];
  onPushSelected?: (paths: string[]) => void;
}) {
  const { activeRepo, activeBranch, projectFiles, onPushSelected } = props;

  const parsed = useMemo(() => (activeRepo ? splitFullName(activeRepo) : null), [activeRepo]);
  const branch = useMemo(() => (activeBranch || "main").trim() || "main", [activeBranch]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DiffItem[]>([]);
  const [note, setNote] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const genRef = useRef(0);

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

  const load = useCallback(async () => {
    if (!parsed) {
      setItems([]);
      setNote("Kein Repo gewählt.");
      return;
    }
    if (!local.length) {
      setItems([]);
      setNote("Keine lokalen Projektdateien gefunden.");
      return;
    }

    const myGen = ++genRef.current;
    setLoading(true);
    setItems([]);
    setNote("");

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
    setItems(results);
    // Default selection: only pushable changes (modified + localOnly)
    const nextSel: Record<string, boolean> = {};
    for (const r of results) {
      if (r.status === "modified" || r.status === "localOnly") nextSel[r.path] = true;
    }
    setSelected(nextSel);
    setLoading(false);
  }, [parsed, local, branch]);

  useEffect(() => {
    // Best-effort auto refresh when switching repo/branch.
    setItems([]);
    setNote("");
    setLoading(false);
  }, [activeRepo, activeBranch]);

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
    async (it: DiffItem) => {
      if (!parsed) return;
      const p = normalizeRepoPath(it.path);
      if (!p) return;

      setPreviewOpen(true);
      setPreviewPath(p);
      setPreviewStatus(it.status);
      setPreviewLoading(true);
      setPreviewLocal("");
      setPreviewRemote("");
      setPreviewDiff("");

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

        setPreviewLocal(localText);
        setPreviewRemote(remoteText);

        if (it.status === "modified") {
          setPreviewDiff(unifiedLineDiff(localText, remoteText));
        } else if (it.status === "localOnly") {
          setPreviewDiff("(Nur lokal vorhanden)\n+ Datei wird beim Push erstellt.");
        } else if (it.status === "remoteOnly") {
          setPreviewDiff("(Nur online vorhanden)\n- Datei fehlt lokal. Pull würde sie holen.");
        } else {
          setPreviewDiff("");
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [parsed, branch, localMap],
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

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Diff Lokal ↔ Online</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {loading ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
          <TouchableOpacity style={styles.iconBtn} onPress={load} disabled={!parsed || loading}>
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

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
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
            Liste kopieren
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
            Push Auswahl ({selectedCount})
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
            <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>Alle anzeigen</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {visibleItems.length ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          {visibleItems.slice(0, 24).map((i) => {
            const pushable = i.status === "modified" || i.status === "localOnly";
            const checked = !!selected[i.path];
            return (
              <Pressable
                key={`${i.status}:${i.path}`}
                onPress={() => openPreview(i)}
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
            );
          })}

          {visibleItems.length > 24 ? (
            <Text style={{ fontSize: 11, color: theme.palette.text.muted }}>
              +{visibleItems.length - 24} weitere…
            </Text>
          ) : null}
        </View>
      ) : null}

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
                      <Text style={{ color: theme.palette.text.primary, fontFamily: "monospace", fontSize: 11 }}>
                        {safeSliceLines(previewDiff, 700).text}
                      </Text>
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
