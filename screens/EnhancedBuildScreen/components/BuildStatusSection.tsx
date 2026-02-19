import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { BuildTimelineCard } from "../../../components/build/BuildTimelineCard";
import { theme } from "../../../theme";
import type { BuildStatus } from "../../../shared/types/build";
import type { CurrentBuildLike } from "../types";

export function BuildStatusSection({
  statusEmoji,
  statusLabel,
  message,
  jobId,
  etaMs,
  formatDuration,
  status,
  currentBuild,
  hasStartBuild,
  buildLoading,
  startDisabled,
  startDisabledReason,
  onStartBuild,
  openRun,
}: {
  status: BuildStatus;
  statusEmoji: string;
  statusLabel: string;
  message: string;
  jobId: string | number | null;
  etaMs: number;
  formatDuration: (ms: number) => string;
  currentBuild: CurrentBuildLike | null;
  hasStartBuild: boolean;
  buildLoading: boolean;
  startDisabled?: boolean;
  startDisabledReason?: string | null;
  onStartBuild: () => void;
  openRun: (url: string) => void;
}): React.ReactElement {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons
          name={status === "success" ? "checkmark-circle" : status === "failed" || status === "error" ? "alert-circle" : "radio-button-on"}
          size={18}
          color={status === "success" ? theme.palette.success : status === "failed" || status === "error" ? theme.palette.error : theme.palette.primary}
        />
        <Text style={s.title}>Build Status</Text>
      </View>

      <View style={s.statusRow}>
        <View style={s.statusTextWrap}>
          <Text style={s.statusLabel}>{statusLabel}</Text>
          {!!message && <Text style={s.statusMsg}>{message}</Text>}
          {!!jobId && <Text style={s.statusMsg}>Job #{jobId}</Text>}
          {etaMs > 0 && (
            <Text style={s.eta}>Restzeit: ~{formatDuration(etaMs)}</Text>
          )}
        </View>
      </View>

      <BuildTimelineCard status={status} />

      {/* Action Buttons - Outlined Style */}
      <View style={s.actions}>
        {!!currentBuild?.urls?.html && (
          <TouchableOpacity
            style={s.outlineBtn}
            onPress={() => openRun(currentBuild.urls?.html || "")}
            activeOpacity={0.7}
          >
            <Ionicons name="open-outline" size={14} color={theme.palette.text.primary} />
            <Text style={s.outlineBtnText}>GitHub Run</Text>
          </TouchableOpacity>
        )}

        {!!currentBuild?.urls?.artifacts && (
          <TouchableOpacity
            style={s.outlineBtn}
            onPress={() => openRun(currentBuild.urls?.artifacts || "")}
            activeOpacity={0.7}
          >
            <Ionicons name="cube-outline" size={14} color={theme.palette.text.primary} />
            <Text style={s.outlineBtnText}>Artifacts</Text>
          </TouchableOpacity>
        )}

        {!!currentBuild?.urls?.buildUrl && (
          <>
            <TouchableOpacity
              style={s.greenOutlineBtn}
              onPress={() => openRun(currentBuild.urls?.buildUrl || "")}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={14} color={theme.palette.primary} />
              <Text style={s.greenOutlineBtnText}>
                {currentBuild.urls.buildUrl.toLowerCase().endsWith(".apk") ||
                currentBuild.urls.buildUrl.includes("/storage/v1/object/")
                  ? "APK Download"
                  : "Build Ergebnis"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.outlineBtn}
              onPress={() => Clipboard.setStringAsync(currentBuild.urls?.buildUrl || "")}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={14} color={theme.palette.text.primary} />
              <Text style={s.outlineBtnText}>Link kopieren</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Start Build Button */}
      {!!startDisabledReason && !!startDisabled ? (
        <Text style={s.blockReason} numberOfLines={3}>
          {startDisabledReason}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[s.startBtn, (!hasStartBuild || buildLoading || startDisabled) && s.disabled]}
        onPress={onStartBuild}
        disabled={!hasStartBuild || buildLoading || !!startDisabled}
        activeOpacity={0.7}
      >
        {buildLoading ? (
          <ActivityIndicator color={theme.palette.primary} size="small" />
        ) : (
          <>
            <Ionicons name="play-outline" size={18} color={theme.palette.primary} />
            <Text style={s.startBtnText}>Build starten</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  title: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 15,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    padding: 12,
    backgroundColor: theme.palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  statusTextWrap: { flex: 1 },
  statusLabel: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  statusMsg: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  eta: {
    color: theme.palette.warning,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: "transparent",
  },
  outlineBtnText: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  greenOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
    backgroundColor: "transparent",
  },
  greenOutlineBtnText: {
    color: theme.palette.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  blockReason: {
    marginTop: 10,
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
    backgroundColor: "transparent",
  },
  startBtnText: {
    color: theme.palette.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  disabled: { opacity: 0.4 },
});
