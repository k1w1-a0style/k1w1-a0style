import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  FlatList,
  LayoutAnimation,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { IssueCard } from "../../../components/diagnostics/IssueCard";
import { SectionCard } from "../../../components/diagnostics/SectionCard";
import { theme } from "../../../theme";
import type { Status } from "../types";
import type { IssuesFilter } from "../hooks/useDiagnosticIssueFiltering";
import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";

function AnimatedIssueRow({
  item,
  index,
  toSeverity,
  openIssue,
}: {
  item: PreflightCheckResult;
  index: number;
  toSeverity: (s: Status) => any;
  openIssue: (item: PreflightCheckResult) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const st = ((item.status ?? "pass") as Status) ?? "pass";
  const severity = toSeverity(st);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <IssueCard
        title={item.title}
        message={item.message}
        severity={severity}
        hasFix={!!item.fix?.patch}
        onPress={() => openIssue(item)}
      />
    </Animated.View>
  );
}

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
      renderItem={({ item, index }) => (
        <AnimatedIssueRow
          item={item}
          index={index}
          toSeverity={toSeverity}
          openIssue={openIssue}
        />
      )}
      ListHeaderComponent={
        <View style={styles.stack}>
          {/* No ModeSelector - mode is auto from build screen */}

          <View style={styles.filtersRow}>
            {(["all", "critical", "warning"] as const).map((k) => {
              const active = issuesFilter === k;
              const label = k === "all" ? "Alle" : k === "critical" ? "Kritisch" : "Warnung";
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
        <SectionCard title="Keine Issues" subtitle="Alles sieht gut aus." icon="checkmark-circle">
          <Text style={styles.muted}>
            Starte eine Diagnostik um den aktuellen Modus zu pruefen.
          </Text>
          <View style={{ height: theme.spacing.sm }} />
          <TouchableOpacity
            style={[styles.btnPrimary, busy && styles.disabled]}
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
