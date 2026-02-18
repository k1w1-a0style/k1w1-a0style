import React from "react";
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { InlineToast } from "../../../components/diagnostics/InlineToast";
import { theme } from "../../../theme";

type HeaderStats = {
  name: string;
  mode: string;
  profileLabel: string;
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
  onDebug?: () => void;
  debugDisabled?: boolean;
  toast: ToastState;
}) {
  const { styles, headerStats, busy, running, toast } = props;
  const onDebug = props.onDebug;
  const debugDisabled = !!props.debugDisabled;

  const profileTag = String(headerStats.profileLabel || "").toUpperCase();

  return (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Ionicons name="flask-outline" size={20} color={theme.palette.primary} />
            <Text style={styles.title}>Diagnostik</Text>
            {profileTag ? <View style={s.profilePill}><Text style={s.profileText}>{profileTag}</Text></View> : null}
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {onDebug ? (
            <TouchableOpacity
              style={[styles.iconBtn, debugDisabled && { opacity: 0.4 }]}
              onPress={onDebug}
              disabled={debugDisabled}
            >
              <Ionicons name="bug-outline" size={18} color={theme.palette.primary} />
            </TouchableOpacity>
          ) : null}

          {busy ? (
            <View style={styles.busyPill}>
              <ActivityIndicator size="small" color={theme.palette.primary} />
              <Text style={styles.busyText}>{running ? "Laeuft..." : "Anwenden..."}</Text>
            </View>
          ) : null}
        </View>
      </View>

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
  profilePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,255,0,0.04)",
  },
  profileText: {
    color: theme.palette.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
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
