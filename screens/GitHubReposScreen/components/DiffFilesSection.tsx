import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
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

  const filesPreview = useMemo(() => files.slice(0, 12), [files]);

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

      {!!error ? (
        <Text style={{ fontSize: 12, color: theme.palette.error, marginTop: 6, lineHeight: 18 }}>
          {error}
        </Text>
      ) : null}

      {activeRepo ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          {filesPreview.length ? (
            filesPreview.map((f) => (
              <View key={f.filename} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Text style={{ width: 22, textAlign: "center" }}>{statusEmoji(f.status)}</Text>
                <Text
                  style={{ flex: 1, fontSize: 12, color: theme.palette.text.secondary }}
                  numberOfLines={1}
                >
                  {f.filename}
                </Text>
                {Number.isFinite(f.changes as any) ? (
                  <Text style={{ fontSize: 11, color: theme.palette.text.muted }}>{f.changes}</Text>
                ) : null}
              </View>
            ))
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
