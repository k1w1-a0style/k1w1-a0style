import React from "react";
import {
  ActivityIndicator,

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

import { s } from "./BuildStatusSection.styles";

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

