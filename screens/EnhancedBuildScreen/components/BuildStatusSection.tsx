import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";

import { BuildTimelineCard } from "../../../components/build/BuildTimelineCard";
import { styles } from "../../../styles/enhancedBuildScreenStyles";
import type { BuildStatus } from "../../../lib/buildStatusMapper";
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
  onStartBuild: () => void;
  openRun: (url: string) => void;
}): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Build Status</Text>

      <View style={styles.statusRow}>
        <Text style={styles.statusEmoji}>{statusEmoji}</Text>
        <View style={styles.statusTextWrap}>
          <Text style={styles.statusLabel}>{statusLabel}</Text>
          {!!message && <Text style={styles.statusMessage}>{message}</Text>}
          {!!jobId && (
            <Text style={styles.statusMessage}>Job ID: #{jobId}</Text>
          )}
          {etaMs > 0 && (
            <Text style={styles.statusMessage}>
              ⏱️ Geschätzte Restzeit: {formatDuration(etaMs)}
            </Text>
          )}
        </View>
      </View>

      {/* Timeline (unified BuildStatus) */}
      <BuildTimelineCard status={status} />

      {!!currentBuild?.urls?.html && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => openRun(currentBuild.urls?.html || "")}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>🔎 GitHub Run öffnen</Text>
        </TouchableOpacity>
      )}

      {!!currentBuild?.urls?.artifacts && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => openRun(currentBuild.urls?.artifacts || "")}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>📦 Artifacts öffnen</Text>
        </TouchableOpacity>
      )}

      {!!currentBuild?.urls?.buildUrl && (
        <>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => openRun(currentBuild.urls?.buildUrl || "")}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>
              {(() => {
                const u = currentBuild?.urls?.buildUrl || "";
                const isApk =
                  u.toLowerCase().endsWith(".apk") ||
                  u.includes("/storage/v1/object/") ||
                  u.includes("/storage/v1/object/sign/");
                return isApk ? "⬇️ APK Download" : "🔗 Build Ergebnis";
              })()}
            </Text>
          </TouchableOpacity>

          <View style={styles.buildLinkWrap}>
            <Text style={styles.buildLinkText} selectable>
              {currentBuild.urls?.buildUrl || ""}
            </Text>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() =>
                Clipboard.setStringAsync(currentBuild.urls?.buildUrl || "")
              }
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>📋 Link kopieren</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (!hasStartBuild || buildLoading) && styles.btnDisabled,
        ]}
        onPress={onStartBuild}
        disabled={!hasStartBuild || buildLoading}
      >
        {buildLoading ? (
          <ActivityIndicator color="#1a1a1a" />
        ) : (
          <Text style={styles.primaryBtnText}>🚀 Build starten</Text>
        )}
      </TouchableOpacity>

      {!hasStartBuild && (
        <Text style={styles.warningText}>
          Implementiere startBuild() in deinem ProjectContext
        </Text>
      )}
    </View>
  );
}