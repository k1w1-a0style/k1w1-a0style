import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
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

function statusEmoji(s: DiffItem["status"]) {
  if (s === "same") return "✅";
  if (s === "modified") return "✏️";
  if (s === "localOnly") return "➕";
  if (s === "remoteOnly") return "⬇️";
  if (s === "skipped") return "⏭️";
  return "⚠️";
}

export function LocalRemoteDiffSection(props: {
  activeRepo: string | null;
  activeBranch: string | null;
  projectFiles: LocalFile[];
}) {
  const { activeRepo, activeBranch, projectFiles } = props;

  const parsed = useMemo(() => (activeRepo ? splitFullName(activeRepo) : null), [activeRepo]);
  const branch = useMemo(() => (activeBranch || "main").trim() || "main", [activeBranch]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DiffItem[]>([]);
  const [note, setNote] = useState<string>("");
  const genRef = useRef(0);

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

  const preview = useMemo(() => items.slice(0, 18), [items]);

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
          onPress={async () => {
            const text = items.map((i) => `${statusEmoji(i.status)} ${i.path}`).join("\n");
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

        {items.length > preview.length ? (
          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={() => {
              Alert.alert(
                "Lokale vs Online Diff",
                items.map((i) => `${statusEmoji(i.status)} ${i.path}${i.detail ? ` (${i.detail})` : ""}`).join("\n"),
              );
            }}
          >
            <Ionicons name="list-outline" size={14} color={theme.palette.text.secondary} />
            <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>Alle anzeigen</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {preview.length ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          {preview.map((i) => (
            <View key={`${i.status}:${i.path}`} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Text style={{ width: 22, textAlign: "center" }}>{statusEmoji(i.status)}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: theme.palette.text.secondary }} numberOfLines={1}>
                {i.path}
              </Text>
            </View>
          ))}
          {items.length > preview.length ? (
            <Text style={{ fontSize: 11, color: theme.palette.text.muted }}>
              +{items.length - preview.length} weitere...
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
