import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import { ActionButton } from "./ActionButton";

function Dot({ ok, styles }: { ok: boolean; styles: any }) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: ok ? theme.palette.success : theme.palette.error },
      ]}
    />
  );
}

function StatusRow(props: {
  styles: any;
  label: string;
  ok: boolean;
  value?: string;
}) {
  const { styles, label, ok, value } = props;
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusLeft}>
        <Dot ok={ok} styles={styles} />
        <Text style={styles.statusLabel}>{label}</Text>
      </View>
      {value ? (
        <Text style={styles.statusValue} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <Text style={styles.statusValueMuted}>{ok ? "OK" : "FEHLT"}</Text>
      )}
    </View>
  );
}

export function StatusCard(props: {
  styles: any;
  busy: boolean;
  status: {
    gh: boolean;
    ex: boolean;
    edge: boolean;
    sbUrl: boolean;
    sbAnon: boolean;
    sbSrv: boolean;
    linked: boolean;
    eas: boolean;
  };
  repoLine: string;
  supabaseUrl: string;
  easProjectId: string;
  onNavigateRepos: () => void;
  onNavigateDiagnostic: () => void;
}) {
  const {
    styles,
    busy,
    status,
    repoLine,
    supabaseUrl,
    easProjectId,
    onNavigateRepos,
    onNavigateDiagnostic,
  } = props;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="pulse-outline" size={18} color={theme.palette.primary} />
        <Text style={styles.cardTitle}>Status</Text>
      </View>

      <StatusRow
        styles={styles}
        label="Repo/Branch verknüpft"
        ok={status.linked}
        value={repoLine || undefined}
      />
      <StatusRow styles={styles} label="GitHub Token (PAT)" ok={status.gh} />
      <StatusRow
        styles={styles}
        label="Expo / EAS Token (EXPO_TOKEN)"
        ok={status.ex}
      />
      <StatusRow
        styles={styles}
        label="Supabase URL"
        ok={status.sbUrl}
        value={status.sbUrl ? supabaseUrl : undefined}
      />
      <StatusRow
        styles={styles}
        label="Supabase ANON Key"
        ok={status.sbAnon}
      />
      <StatusRow
        styles={styles}
        label="Supabase Service Role"
        ok={status.sbSrv}
      />
      <StatusRow
        styles={styles}
        label="Edge Admin Key (optional)"
        ok={status.edge}
      />
      <StatusRow
        styles={styles}
        label="EAS Project ID (optional)"
        ok={status.eas}
        value={status.eas ? easProjectId : undefined}
      />

      <View style={styles.row}>
        <ActionButton
          styles={styles}
          busy={busy}
          label="Zu Repos/Branches"
          icon="logo-github"
          onPress={onNavigateRepos}
        />
        <ActionButton
          styles={styles}
          busy={busy}
          label="Diagnose"
          icon="flask-outline"
          variant="ghost"
          onPress={onNavigateDiagnostic}
        />
      </View>
    </View>
  );
}
