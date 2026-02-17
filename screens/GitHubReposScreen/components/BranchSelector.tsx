import React, { memo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const generationRef = useRef(0);

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [expanded, rotateAnim]);

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

        if (currentGen !== generationRef.current) return;

        setBranches(branchList);
        if (!activeBranch && defaultBranch) {
          onSelectBranch(defaultBranch);
        }
      } catch (e) {
        if (currentGen !== generationRef.current) return;
        console.error("[BranchSelector] Fehler:", e);
      } finally {
        if (currentGen === generationRef.current) setLoading(false);
      }
    };

    load();
  }, [activeRepo, loadBranches, loadDefaultBranch, activeBranch, onSelectBranch]);

  if (!activeRepo) return null;

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={s.selector}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Ionicons name="git-branch-outline" size={16} color={theme.palette.primary} />
        <View style={s.selectorTextWrap}>
          <Text style={s.selectorLabel}>Branch</Text>
          {loading ? (
            <ActivityIndicator size="small" color={theme.palette.primary} />
          ) : (
            <Text style={s.selectorValue}>{activeBranch || "Waehlen..."}</Text>
          )}
        </View>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="chevron-down" size={18} color={theme.palette.text.secondary} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && branches.length > 0 && (
        <ScrollView
          style={s.dropdown}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {branches.map((branch) => {
            const isActive = branch.name === activeBranch;
            return (
              <TouchableOpacity
                key={branch.name}
                style={[s.dropdownItem, isActive && s.dropdownItemActive]}
                onPress={() => {
                  onSelectBranch(branch.name);
                  setExpanded(false);
                }}
                activeOpacity={0.7}
              >
                {isActive && (
                  <Ionicons name="checkmark" size={14} color={theme.palette.primary} />
                )}
                {branch.protected && (
                  <Ionicons name="lock-closed" size={12} color={theme.palette.warning} />
                )}
                <Text style={[s.dropdownText, isActive && s.dropdownTextActive]} numberOfLines={1}>
                  {branch.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {expanded && branches.length === 0 && !loading && (
        <Text style={s.empty}>Keine Branches gefunden</Text>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    overflow: "hidden",
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  selectorTextWrap: {
    flex: 1,
    gap: 2,
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.palette.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectorValue: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.palette.primary,
  },
  dropdown: {
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.palette.border,
  },
  dropdownItemActive: {
    backgroundColor: "rgba(0,255,0,0.06)",
  },
  dropdownText: {
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: "600",
    flex: 1,
  },
  dropdownTextActive: {
    color: theme.palette.primary,
    fontWeight: "800",
  },
  empty: {
    padding: 14,
    fontSize: 12,
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
});
