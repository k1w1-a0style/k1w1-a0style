import React, { memo, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { theme } from "../../../theme";
import { styles } from "../styles";
import { RepoFilterType } from "../types";

interface FilterSectionProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: RepoFilterType;
  setFilterType: (type: RepoFilterType) => void;
  recentRepos: string[];
  activeRepo: string | null;
  setActiveRepo: (repo: string | null) => void;
  clearRecentRepos: () => void;
}

export const FilterSection = memo(function FilterSection({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  recentRepos,
  activeRepo,
  setActiveRepo,
  clearRecentRepos,
}: FilterSectionProps) {
  const onPressRecent = useCallback(
    (r: string) => setActiveRepo(r),
    [setActiveRepo],
  );

  const renderRecentRepos = () => {
    if (!recentRepos.length)
      return (
        <Text style={styles.noRecentText}>
          Noch keine „zuletzt genutzten“ Repos.
        </Text>
      );

    return (
      <View style={styles.recentContainer}>
        {recentRepos.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.recentPill,
              r === activeRepo && styles.recentPillActive,
            ]}
            onPress={() => onPressRecent(r)}
          >
            <Text style={styles.recentPillText}>{r}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={clearRecentRepos}>
          <Text style={styles.clearRecentText}>Verlauf löschen</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Filter</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Repos filtern..."
          placeholderTextColor={theme.palette.text.secondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === "all" && styles.filterButtonActive,
          ]}
          onPress={() => setFilterType("all")}
        >
          <Text
            style={
              filterType === "all"
                ? styles.filterButtonTextActive
                : styles.filterButtonText
            }
          >
            Alle
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === "activeOnly" && styles.filterButtonActive,
          ]}
          onPress={() => setFilterType("activeOnly")}
        >
          <Text
            style={
              filterType === "activeOnly"
                ? styles.filterButtonTextActive
                : styles.filterButtonText
            }
          >
            Aktives Repo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === "recentOnly" && styles.filterButtonActive,
          ]}
          onPress={() => setFilterType("recentOnly")}
        >
          <Text
            style={
              filterType === "recentOnly"
                ? styles.filterButtonTextActive
                : styles.filterButtonText
            }
          >
            Zuletzt genutzt
          </Text>
        </TouchableOpacity>
      </View>

      {renderRecentRepos()}
    </View>
  );
});
