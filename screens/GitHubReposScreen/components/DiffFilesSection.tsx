import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";
import { splitFullName } from "../utils/repos";
import { compareBranches, type GitHubCompareFile } from "../../../infra/github/githubService";

function statusEmoji(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "added") return "➕";
  if (s === "modified") return "✏️";
  if (s === "removed") return "🗑️";
  if (s === "renamed") return "🔁";
  return "•";
}

function safeOpenUrl(url: string) {
  if (!url) return;
  Linking.openURL(url).catch(() => {});
}

function buildCompareUrl(owner: string, repo: string, base: string, head: string) {
  const b = encodeURIComponent(base);
  const h = encodeURIComponent(head);
  return `https://github.com/${owner}/${repo}/compare/${b}...${h}`;
}

function buildBlobUrl(owner: string, repo: string, ref: string, filename: string) {
  const r = encodeURIComponent(ref);
  // filename already includes slashes; keep as is
  return `https://github.com/${owner}/${repo}/blob/${r}/${filename}`;
}

export function DiffFilesSection(props: {
  activeRepo: string | null;
  activeBranch: string | null;
  loadDefaultBranch: (owner: string, repo: string) => Promise<string>;
}) {
  const { activeRepo, activeBranch, loadDefaultBranch } = props;

  const parsed = useMemo(() => (activeRepo ? splitFullName(activeRepo) : null), [activeRepo]);

  const [defaultBranch, setDefaultBranch] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aheadBy, setAheadBy] = useState(0);
  const [behindBy, setBehindBy] = useState(0);
  const [totalCommits, setTotalCommits] = useState(0);
  const [files, setFiles] = useState<GitHubCompareFile[]>([]);

  const headBranch = useMemo(() => {
    if (!activeRepo) return "";
    return (activeBranch || defaultBranch || "").trim();
  }, [activeBranch, activeRepo, defaultBranch]);

  const load = useCallback(async () => {
    if (!parsed) {
      setDefaultBranch("");
      setError(null);
      setFiles([]);
      setAheadBy(0);
      setBehindBy(0);
      setTotalCommits(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const def = await loadDefaultBranch(parsed.owner, parsed.repo);
      const base = (def || "").trim() || "main";
      setDefaultBranch(base);

      const head = (activeBranch || base).trim();
      const res = await compareBranches({
        owner: parsed.owner,
        repo: parsed.repo,
        base,
        head,
        perPage: 100,
      });
      setAheadBy(res.aheadBy);
      setBehindBy(res.behindBy);
      setTotalCommits(res.totalCommits);
      setFiles(res.files);
    } catch (e: any) {
      setError(e?.message || "Diff konnte nicht geladen werden.");
      setFiles([]);
      setAheadBy(0);
      setBehindBy(0);
      setTotalCommits(0);
    } finally {
      setLoading(false);
    }
  }, [activeBranch, loadDefaultBranch, parsed]);

  useEffect(() => {
    load();
  }, [load]);

  const filesPreview = useMemo(() => files.slice(0, 16), [files]);

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Diff Dateien</Text>
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

      {!activeRepo ? (
        <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>
          Kein Repo gewählt.
        </Text>
      ) : null}

      {activeRepo ? (
        <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18 }}>
          Base: {defaultBranch || "?"} → Head: {headBranch || "?"}
          {totalCommits ? ` • Commits: ${totalCommits}` : ""}
          {(aheadBy || behindBy) ? ` • +${aheadBy} / -${behindBy}` : ""}
        </Text>
      ) : null}
      {activeRepo && parsed ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", alignItems: "center", gap: 6 }]}
            onPress={() => safeOpenUrl(buildCompareUrl(parsed.owner, parsed.repo, defaultBranch || "main", headBranch || (defaultBranch || "main")))}
          >
            <Ionicons name="open-outline" size={14} color={theme.palette.text.secondary} />
            <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>Compare öffnen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", alignItems: "center", gap: 6 }]}
            onPress={async () => {
              const list = files.map((f) => `${statusEmoji(f.status)} ${f.filename}`).join("\n");
              await Clipboard.setStringAsync(list);
            }}
            disabled={!files.length}
          >
            <Ionicons name="copy-outline" size={14} color={files.length ? theme.palette.text.secondary : theme.palette.text.muted} />
            <Text style={{ fontSize: 12, color: files.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
              Liste kopieren
            </Text>
          </TouchableOpacity>

          {files.length > filesPreview.length ? (
            <TouchableOpacity
              style={[styles.chip, { flexDirection: "row", alignItems: "center", gap: 6 }]}
              onPress={() => {
                Alert.alert("Diff Dateien", files.map((f) => `${statusEmoji(f.status)} ${f.filename}`).join("\n"));
              }}
            >
              <Ionicons name="list-outline" size={14} color={theme.palette.text.secondary} />
              <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>Alle anzeigen</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {!!error ? (
        <Text style={{ fontSize: 12, color: theme.palette.error, marginTop: 6, lineHeight: 18 }}>
          {error}
        </Text>
      ) : null}

      {activeRepo ? (
        <View style={{ marginTop: 10, gap: 6 }}>

          {filesPreview.length ? (
            filesPreview.map((f) => {
              const baseRef = (defaultBranch || "main").trim();
              const headRef = (headBranch || baseRef).trim();
              const refForFile = (String(f.status || "").toLowerCase() === "removed") ? baseRef : headRef;
              const url = parsed ? buildBlobUrl(parsed.owner, parsed.repo, refForFile, f.filename) : "";

              return (
                <TouchableOpacity
                  key={f.filename}
                  onPress={() => safeOpenUrl(url)}
                  style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 2 }}
                  disabled={!parsed}
                >
                  <Text style={{ width: 22, textAlign: "center" }}>{statusEmoji(f.status)}</Text>

                  <Text
                    style={{ flex: 1, fontSize: 12, color: theme.palette.text.secondary }}
                    numberOfLines={1}
                  >
                    {f.filename}
                  </Text>

                  {Number.isFinite(f.additions as any) ? (
                    <Text style={{ fontSize: 11, color: theme.palette.primary }}>{`+${f.additions}`}</Text>
                  ) : null}
                  {Number.isFinite(f.deletions as any) ? (
                    <Text style={{ fontSize: 11, color: theme.palette.error }}>{`-${f.deletions}`}</Text>
                  ) : null}
                </TouchableOpacity>
              );

            })
          ) : (
            <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>
              Keine Änderungen.
            </Text>
          )}

          {files.length > filesPreview.length ? (
            <Text style={{ fontSize: 11, color: theme.palette.text.muted }}>
              +{files.length - filesPreview.length} weitere Dateien...
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
