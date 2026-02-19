import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import { ActionButton } from "./ActionButton";

function ConnectionLight({ ok, label }: { ok: boolean; label?: string }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (ok) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
    glowAnim.setValue(0);
  }, [ok, pulseAnim, glowAnim]);

  return (
    <View style={s.lightRow}>
      <Animated.View
        style={[
          s.light,
          ok && s.lightOn,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      {label ? <Text style={[s.lightLabel, ok && s.lightLabelOk]}>{label}</Text> : null}
    </View>
  );
}

function StatusRow(props: {
  label: string;
  ok: boolean;
  value?: string;
  accountName?: string;
  detail?: string;
}) {
  const { label, ok, value, accountName, detail } = props;
  return (
    <View style={s.statusRow}>
      <ConnectionLight ok={ok} />
      <View style={s.statusTextWrap}>
        <Text style={s.statusLabel}>{label}</Text>
        {accountName ? (
          <Text style={s.accountName}>@{accountName}</Text>
        ) : null}
        {detail ? (
          <Text style={s.detailLine} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={s.statusValue} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <Text style={[s.statusBadge, ok ? s.badgeOk : s.badgeFail]}>
          {ok ? "OK" : "FEHLT"}
        </Text>
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
  githubOk?: boolean;
  githubUser?: string;
  githubScopes?: string;
  supabaseOk?: boolean;
  expoOk?: boolean;
  expoUser?: string;
  easOk?: boolean;
  onNavigateRepos: () => void;
  onNavigateDiagnostic: () => void;
}) {
  const {
    styles: parentStyles,
    busy,
    status,
    repoLine,
    supabaseUrl,
    easProjectId,
    githubOk,
    githubUser,
    githubScopes,
    supabaseOk,
    expoOk,
    expoUser,
    easOk,
    onNavigateRepos,
    onNavigateDiagnostic,
  } = props;

  return (
    <View style={parentStyles.card}>
      <View style={s.cardHeader}>
        <Ionicons name="pulse-outline" size={18} color={theme.palette.primary} />
        <Text style={s.cardTitle}>Verbindungen</Text>
      </View>

      <StatusRow
        label="GitHub"
        ok={githubOk ?? status.gh}
        accountName={githubUser || undefined}
        detail={githubScopes ? `Scopes: ${githubScopes}` : undefined}
      />
      <StatusRow
        label="Expo"
        ok={expoOk ?? status.ex}
        accountName={expoUser || undefined}
      />
      <StatusRow
        label="Supabase"
        ok={supabaseOk ?? status.sbUrl}
        value={status.sbUrl ? supabaseUrl : undefined}
      />
      <StatusRow
        label="Repo verknuepft"
        ok={status.linked}
        value={repoLine || undefined}
      />
      <StatusRow
        label="EAS Project"
        ok={easOk ?? status.eas}
        value={status.eas ? easProjectId : undefined}
      />

      <View style={parentStyles.row}>
        <ActionButton
          styles={parentStyles}
          busy={busy}
          label="Repos"
          icon="logo-github"
          onPress={onNavigateRepos}
        />
        <ActionButton
          styles={parentStyles}
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

const s = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  lightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  light: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.palette.text.disabled,
    borderWidth: 1.5,
    borderColor: theme.palette.border,
  },
  lightOn: {
    backgroundColor: theme.palette.success,
    borderColor: theme.palette.success,
    shadowColor: theme.palette.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  lightLabel: {
    color: theme.palette.text.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  lightLabelOk: {
    color: theme.palette.success,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    gap: 10,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusLabel: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  detailLine: {
    marginTop: 2,
    color: theme.palette.text.muted,
    fontSize: 12,
    lineHeight: 16,
  },

  accountName: {
    color: theme.palette.primary,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  statusValue: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    maxWidth: "45%",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    letterSpacing: 0.5,
  },
  badgeOk: {
    color: theme.palette.success,
    borderWidth: 1,
    borderColor: "rgba(0,255,0,0.3)",
    backgroundColor: "rgba(0,255,0,0.08)",
  },
  badgeFail: {
    color: theme.palette.error,
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.3)",
    backgroundColor: "rgba(255,68,68,0.08)",
  },
});
