import React from "react";
import {
  FlatList,
  LayoutAnimation,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ModeSelector } from "../../../components/diagnostics/ModeSelector";
import { IssueCard } from "../../../components/diagnostics/IssueCard";
import { SectionCard } from "../../../components/diagnostics/SectionCard";
import { theme } from "../../../theme";
import type { Status } from "../types";
import type { IssuesFilter } from "../hooks/useDiagnosticIssueFiltering";
import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";

export function IssuesTabSection(props: {
  styles: any;
  issueList: PreflightCheckResult[];
  modeAdvanced: boolean;
  setModeAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  recommendedMode: any;
  selectedModes: any;
  setSelectedModes: any;
  modesAll: boolean;
  setModesAll: React.Dispatch<React.SetStateAction<boolean>>;
  busy: boolean;
  issuesFilter: IssuesFilter;
  setIssuesFilter: React.Dispatch<React.SetStateAction<IssuesFilter>>;
  toSeverity: (s: Status) => any;
  openIssue: (item: PreflightCheckResult) => void;
  runDiagnostics: () => void;
}) {
  const {
    styles,
    issueList,
    modeAdvanced,
    setModeAdvanced,
    recommendedMode,
    selectedModes,
    setSelectedModes,
    modesAll,
    setModesAll,
    busy,
    issuesFilter,
    setIssuesFilter,
    toSeverity,
    openIssue,
    runDiagnostics,
  } = props;

  return (
    <FlatList
      data={issueList}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
      renderItem={({ item }) => {
        const st = ((item.status ?? "pass") as Status) ?? "pass";
        const severity = toSeverity(st);
        return (
          <IssueCard
            title={item.title}
            message={item.message}
            severity={severity}
            hasFix={!!item.fix?.patch}
            onPress={() => openIssue(item)}
          />
        );
      }}
      ListHeaderComponent={
        <View style={styles.stack}>
          <ModeSelector
            isAdvanced={modeAdvanced}
            onToggleAdvanced={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setModeAdvanced((prev) => {
                const next = !prev;
                if (next) {
                  // When entering advanced, seed selection with the recommended mode.
                  setSelectedModes((p: any[]) => (p.length ? p : [recommendedMode]));
                }
                return next;
              });
            }}
            recommendedMode={recommendedMode}
            selectedModes={selectedModes}
            onChangeSelected={setSelectedModes}
            allowAll
            allSelected={modesAll}
            onToggleAll={() => {
              setModesAll((prev) => {
                const next = !prev;
                if (next) setSelectedModes(["development", "preview", "production"]);
                return next;
              });
            }}
            disabled={busy}
          />

          <View style={styles.filtersRow}>
            {(["all", "critical", "warning"] as const).map((k) => {
              const active = issuesFilter === k;
              const label =
                k === "all" ? "All" : k === "critical" ? "Critical" : "Warning";
              return (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipOn,
                    busy && styles.disabled,
                  ]}
                  onPress={() => setIssuesFilter(k)}
                  disabled={busy}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextOn,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <SectionCard title="No issues" subtitle="Alles sieht gut aus." icon="checkmark-circle">
          <Text style={styles.muted}>
            Starte eine Diagnose oder wechsle den Mode, falls du andere Profile prüfen willst.
          </Text>
          <View style={{ height: theme.spacing.sm }} />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => runDiagnostics()}
            disabled={busy}
          >
            <Ionicons name="play" size={16} color={theme.palette.primary} />
            <Text style={styles.btnPrimaryText}>Diagnostik starten</Text>
          </TouchableOpacity>
        </SectionCard>
      }
    />
  );
}
