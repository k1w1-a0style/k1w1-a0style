import React, { memo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { GitHubBranch } from "../../../hooks/useGitHubRepos";

import { s } from "./BranchSelector.styles";

interface BranchSelectorProps {
  activeRepo: string | null;
  activeBranch: string | null;
  onSelectBranch: (branch: string) => void;
  onCreateBranch?: () => void;
  onRenameBranch?: () => void;
  onDeleteBranch?: () => void;
  loadBranches: (owner: string, repo: string) => Promise<GitHubBranch[]>;
  loadDefaultBranch: (owner: string, repo: string) => Promise<string>;
}

export const BranchSelector = memo(function BranchSelector({
  activeRepo,
  activeBranch,
  onSelectBranch,
  onCreateBranch,
  onRenameBranch,
  onDeleteBranch,
  loadBranches,
  loadDefaultBranch,
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
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

  // Load recent branches (best-effort) when opening or repo changes
  useEffect(() => {
    if (!activeRepo) {
      setRecent([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_BRANCHES_BY_REPO).catch(
          () => null,
        );
        const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
        const list = Array.isArray(map[activeRepo]) ? map[activeRepo] : [];
        if (mounted) setRecent(list.slice(0, 6));
      } catch {
        if (mounted) setRecent([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeRepo, expanded]);

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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!!onCreateBranch && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onCreateBranch();
              }}
              style={[s.actionIconBtn]}
              accessibilityLabel="Branch erstellen"
            >
              <Ionicons name="add" size={16} color={theme.palette.primary} />
            </TouchableOpacity>
          )}

          {!!onRenameBranch && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onRenameBranch();
              }}
              style={[s.actionIconBtn]}
              disabled={!activeBranch}
              accessibilityLabel="Branch umbenennen"
            >
              <Ionicons
                name="pencil"
                size={16}
                color={activeBranch ? theme.palette.primary : theme.palette.text.muted}
              />
            </TouchableOpacity>
          )}

          {!!onDeleteBranch && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onDeleteBranch();
              }}
              style={[s.actionIconBtn]}
              disabled={!activeBranch}
              accessibilityLabel="Branch löschen"
            >
              <Ionicons
                name="trash"
                size={16}
                color={activeBranch ? theme.palette.error : theme.palette.text.muted}
              />
            </TouchableOpacity>
          )}

          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="chevron-down" size={18} color={theme.palette.text.secondary} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {expanded && branches.length > 0 && (
        <ScrollView
          style={s.dropdown}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={s.searchWrap}>
            <Ionicons name="search" size={14} color={theme.palette.text.secondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Branch suchen…"
              placeholderTextColor={theme.palette.text.secondary}
              autoCorrect={false}
              autoCapitalize="none"
              style={s.searchInput}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={s.clearBtn}
                accessibilityLabel="Branch-Suche löschen"
              >
                <Ionicons name="close" size={16} color={theme.palette.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {search.length === 0 && recent.length > 0 && (
            <View style={s.recentWrap}>
              <Text style={s.recentTitle}>Zuletzt genutzt</Text>
              <View style={s.recentRow}>
                {recent.map((br) => (
                  <TouchableOpacity
                    key={br}
                    onPress={() => {
                      onSelectBranch(br);
                      setExpanded(false);
                    }}
                    style={s.recentPill}
                    activeOpacity={0.75}
                  >
                    <Text style={s.recentPillText} numberOfLines={1}>
                      {br}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {(() => {
            const needle = search.trim().toLowerCase();
            const list = needle
              ? branches.filter((b) => b.name.toLowerCase().includes(needle))
              : branches;
            if (needle && list.length === 0) {
              return <Text style={s.empty}>Keine Treffer</Text>;
            }
            return list.map((branch) => {
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
                  <Text
                    style={[s.dropdownText, isActive && s.dropdownTextActive]}
                    numberOfLines={1}
                  >
                    {branch.name}
                  </Text>
                </TouchableOpacity>
              );
            });
          })()}
        </ScrollView>
      )}

      {expanded && branches.length === 0 && !loading && (
        <Text style={s.empty}>Keine Branches gefunden</Text>
      )}
    </View>
  );
});

