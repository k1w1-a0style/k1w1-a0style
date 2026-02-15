import React, { memo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { theme } from "../../../theme";
import { GitHubBranch } from "../../../hooks/useGitHubRepos";

interface BranchSelectorProps {
  activeRepo: string | null;
  activeBranch: string | null;
  onSelectBranch: (branch: string) => void;
  loadBranches: (owner: string, repo: string) => Promise<GitHubBranch[]>;
  loadDefaultBranch: (owner: string, repo: string) => Promise<string>;
}

export const BranchSelector = memo(function BranchSelector({
  activeRepo,
  activeBranch,
  onSelectBranch,
  loadBranches,
  loadDefaultBranch,
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Guard against stale async responses when switching repos quickly
  const generationRef = useRef(0);

  useEffect(() => {
    if (!activeRepo) {
      setBranches([]);
      return;
    }

    const [owner, repo] = activeRepo.split("/");
    if (!owner || !repo) return;


    generationRef.current += 1;
    const currentGen = generationRef.current;

    const load = async () => {
      setLoading(true);
      try {
        const [branchList, defaultBranch] = await Promise.all([
          loadBranches(owner, repo),
          loadDefaultBranch(owner, repo),
        ]);

        if (currentGen !== generationRef.current) {
          // Ignore stale response
          return;
        }

        setBranches(branchList);

        // Wenn noch kein Branch gewählt, Default setzen
        if (!activeBranch && defaultBranch) {
          onSelectBranch(defaultBranch);
        }
      } catch (e) {
        if (currentGen !== generationRef.current) {
          return;
        }
        console.error("[BranchSelector] Fehler:", e);
      } finally {
        if (currentGen === generationRef.current) {
          setLoading(false);
        }
      }
    };

    load();
  }, [
    activeRepo,
    loadBranches,
    loadDefaultBranch,
    activeBranch,
    onSelectBranch,
  ]);

  if (!activeRepo) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>🌿 Branch:</Text>
        <View style={styles.currentBranch}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.palette.primary} />
          ) : (
            <Text style={styles.branchName}>{activeBranch || "–"}</Text>
          )}
          <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {expanded && branches.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.branchList}
          contentContainerStyle={styles.branchListContent}
        >
          {branches.map((branch) => {
            const isActive = branch.name === activeBranch;
            return (
              <TouchableOpacity
                key={branch.name}
                style={[styles.branchPill, isActive && styles.branchPillActive]}
                onPress={() => {
                  onSelectBranch(branch.name);
                  setExpanded(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.branchPillText,
                    isActive && styles.branchPillTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {branch.protected && "🔒 "}
                  {branch.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {expanded && branches.length === 0 && !loading && (
        <Text style={styles.noBranches}>Keine Branches gefunden</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.palette.text.primary,
  },
  currentBranch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  branchName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.palette.primary,
  },
  chevron: {
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  branchList: {
    marginTop: 12,
    maxHeight: 40,
  },
  branchListContent: {
    gap: 8,
    paddingRight: 8,
  },
  branchPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
  },
  branchPillActive: {
    backgroundColor: "rgba(0, 255, 0, 0.10)",
    borderColor: theme.palette.primary,
    ...theme.glow.primarySubtle,
  },
  branchPillText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  branchPillTextActive: {
    color: theme.palette.primary,
    fontWeight: "700",
  },
  noBranches: {
    marginTop: 8,
    fontSize: 12,
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
});