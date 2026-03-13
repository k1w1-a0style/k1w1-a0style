import React from "react";
import { LayoutAnimation, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "../../../theme";
import { SectionCard } from "../../../components/diagnostics/SectionCard";

import type { ModeDef, StatusResult, UiModeId } from "../types";
import { InlineHint, PrimaryButton, TertiaryButton } from "./ui";
import { styles } from "../styles";

export function KeystoreStatusSection({
  modes,
  statusByMode,
  selectedMode,
  setSelectedMode,
  canRun,
  busy,
  metaForStatus,
  normalizeModeForUi,
  pickStorageBucket,
  pickStoragePath,
  pickUpdatedAt,
  refreshStatus,
  generate,
}: {
  modes: ModeDef[];
  statusByMode: Record<UiModeId, StatusResult | null>;
  selectedMode: UiModeId;
  setSelectedMode: (v: UiModeId) => void;
  canRun: boolean;
  busy: string | null;
  metaForStatus: (s: StatusResult | null, mode: UiModeId) => { icon: any; text: string; color: string };
  normalizeModeForUi: (mode?: string) => UiModeId | undefined;
  pickStorageBucket: (record?: StatusResult["record"]) => string | undefined;
  pickStoragePath: (record?: StatusResult["record"]) => string | undefined;
  pickUpdatedAt: (record?: StatusResult["record"]) => string | undefined;
  refreshStatus: (mode: UiModeId) => void | Promise<void>;
  generate: (mode: UiModeId) => void | Promise<void>;
}) {
  return (
    <SectionCard title="Keystore Status" subtitle="Per mode" icon="checkmark-done-outline">
      {modes.map((m) => {
        const s = statusByMode[m.id];
        const meta = metaForStatus(s, m.id);
        const active = selectedMode === m.id;

        const recordMode = normalizeModeForUi(String(s?.record?.mode ?? ""));
        const alias = s?.record?.alias ?? "—";
        const bucket = pickStorageBucket(s?.record);
        const path = pickStoragePath(s?.record);
        const updated = pickUpdatedAt(s?.record);

        const storageLine = bucket && path ? `${bucket}/${path}` : path || bucket || "—";
        const updatedLine = updated ? new Date(updated).toLocaleString() : "—";

        return (
          <TouchableOpacity
            key={m.id}
            accessibilityRole="button"
            activeOpacity={0.9}
            onPress={() => {
              if (selectedMode === m.id) return;
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedMode(m.id);
            }}
            style={[styles.statusRow, active && styles.statusRowActive]}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.statusTop}>
                <Text style={styles.statusTitle}>{m.label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                  <Text style={[styles.statusMeta, { color: meta.color }]}>{meta.text}</Text>
                </View>
              </View>

              <Text style={styles.kvMuted} numberOfLines={1}>
                Alias: <Text style={styles.kvValue}>{s?.exists ? alias : "—"}</Text>
              </Text>
              <Text style={styles.kvMuted} numberOfLines={1}>
                Path: <Text style={styles.kvValue}>{s?.exists ? storageLine : "—"}</Text>
              </Text>
              <Text style={styles.kvMuted} numberOfLines={1}>
                Last known update: <Text style={styles.kvValue}>{s?.exists ? updatedLine : "—"}</Text>
              </Text>

              <Text style={styles.kvMuted} numberOfLines={2}>
                Statusquelle: <Text style={styles.kvValue}>{busy === `status:${m.id}` ? "wird frisch geprüft…" : "zuletzt bekannter Backend-Status"}</Text>
              </Text>

              {recordMode && recordMode !== m.id ? (
                <InlineHint
                  icon="warning-outline"
                  text={`Backend returned mode '${recordMode}'. UI expects '${m.id}'. (ok, normalized)`}
                  tone="warning"
                />
              ) : null}
            </View>

            <View style={{ gap: 8, marginLeft: theme.spacing.sm }}>
              <TertiaryButton title="Status" onPress={() => refreshStatus(m.id)} disabled={!canRun || Boolean(busy)} />
              <PrimaryButton
                title="Generate"
                onPress={() => generate(m.id)}
                disabled={!canRun || Boolean(busy)}
                small
              />
            </View>
          </TouchableOpacity>
        );
      })}

      {!canRun ? (
        <View style={styles.notice}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.palette.warning} />
          <Text style={styles.noticeText}>Supabase URL / Repo / Admin-Key fehlen — oben setzen.</Text>
        </View>
      ) : null}
    </SectionCard>
  );
}
