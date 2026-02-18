import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SegmentedTabs } from "../../../components/diagnostics/SegmentedTabs";
import { InlineToast } from "../../../components/diagnostics/InlineToast";
import { theme } from "../../../theme";

type TabKey = "overview" | "issues" | "fixes";

type HeaderStats = {
  name: string;
  mode: string;
};

type ToastState = {
  message: string | null;
  anim: any;
};

export function HeaderSection(props: {
  styles: any;
  headerStats: HeaderStats;
  busy: boolean;
  running: boolean;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  tabDefs: { key: TabKey; label: string }[];
  toast: ToastState;
}) {
  const { styles, headerStats, busy, running, tab, setTab, tabDefs, toast } = props;

  return (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Ionicons name="flask-outline" size={20} color={theme.palette.primary} />
            <Text style={styles.title}>Diagnostik</Text>
          </View>
          <View style={s.modeRow}>
            <View style={s.modeBadge}>
              <View style={s.modeDot} />
              <Text style={s.modeText}>{headerStats.mode}</Text>
            </View>
            <Text style={s.projectName}>{headerStats.name}</Text>
          </View>
          <Text style={s.autoHint}>Modus automatisch vom Build-Screen</Text>
        </View>

        {busy ? (
          <View style={styles.busyPill}>
            <ActivityIndicator size="small" color={theme.palette.primary} />
            <Text style={styles.busyText}>
              {running ? "Laeuft..." : "Anwenden..."}
            </Text>
          </View>
        ) : null}
      </View>

      <SegmentedTabs value={tab} onChange={setTab} tabs={tabDefs} />

      <InlineToast message={toast.message} anim={toast.anim} />
    </>
  );
}

const s = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,255,0,0.04)",
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.primary,
  },
  modeText: {
    color: theme.palette.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  projectName: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  autoHint: {
    color: theme.palette.text.muted,
    fontSize: 10,
    fontStyle: "italic",
  },
});
