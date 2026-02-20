import React, { useEffect, useMemo, useRef } from "react";
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

function ScopeBadge({ text, warn }: { text: string; warn?: boolean }) {
  return (
    <View style={[s.badgePill, warn ? s.badgeWarn : s.badgeNeutral]}>
      <Text style={[s.badgePillText, warn ? s.badgeWarnText : s.badgeNeutralText]}>
        {text}
      </Text>
    </View>
  );
}

function StatusRow(props: {
  label: string;
  ok: boolean;
  value?: string;
  accountName?: string;
  detail?: string;
  detailNode?: React.ReactNode;
}) {
  const { label, ok, value, accountName, detail, detailNode } = props;
  return (
    <View style={s.statusRow}>
      <ConnectionLight ok={ok} />
      <View style={s.statusTextWrap}>
        <Text style={s.statusLabel}>{label}</Text>
        {accountName ? <Text style={s.accountName}>@{accountName}</Text> : null}
        {detailNode ? (
          <View style={s.detailNodeWrap}>{detailNode}</View>
        ) : detail ? (
          <Text style={s.detailLine} numberOfLines={3}>
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

function formatGitHubScopes(scopesRaw?: string): { scopes: string[]; missing: string[]; unknown: boolean } {
  const raw = (scopesRaw || "").trim();
  if (!raw) return { scopes: [], missing: [], unknown: true };
  const scopes = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const uniq = Array.from(new Set(scopes)).sort((a, b) => a.localeCompare(b));

  // Classic PAT scopes we typically need for dispatch/reading workflows
  const required = ["repo", "workflow"];
  const missing = required.filter((r) => !uniq.includes(r));

  return { scopes: uniq, missing, unknown: false };
}

function formatSupabaseDisplay(url: string, ref?: string): { value?: string; detail?: string } {
  const u = (url || "").trim();
  if (!u) return {};
  const host = u.replace(/^https?:\/\//i, "").split("/")[0] || u;

  const detectedRef = (ref || "").trim();
  if (detectedRef) {
    return {
      value: detectedRef,
      detail: `Host: ${host}`,
    };
  }

  // Should not normally happen (we validate .supabase.co), but keep it robust.
  const isSupabaseCo = /\.supabase\.co$/i.test(host);
  return {
    value: host,
    detail: isSupabaseCo ? "Ref konnte nicht erkannt werden." : "Custom Domain (Ref unbekannt).",
  };
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
  supabaseRef?: string;
  easProjectId: string;
  githubOk?: boolean;
  githubUser?: string;
  githubScopes?: string;
  supabaseOk?: boolean;
  expoOk?: boolean;
  expoUser?: string;
  easOk?: boolean;
  easInitRunning?: boolean;
  onNavigateRepos: () => void;
  onNavigateDiagnostic: () => void;
  onNavigateBuild: () => void;
}) {
  const {
    styles: parentStyles,
    busy,
    status,
    repoLine,
    supabaseUrl,
    supabaseRef,
    easProjectId,
    githubOk,
    githubUser,
    githubScopes,
    supabaseOk,
    expoOk,
    expoUser,
    easOk,
    easInitRunning,
    onNavigateRepos,
    onNavigateDiagnostic,
    onNavigateBuild,
  } = props;

  const ghIsOk = githubOk ?? status.gh;
  const scopesInfo = useMemo(() => formatGitHubScopes(githubScopes), [githubScopes]);

  const supaIsOk = supabaseOk ?? status.sbUrl;
  const supaDisplay = useMemo(
    () => (supaIsOk ? formatSupabaseDisplay(supabaseUrl, supabaseRef) : {}),
    [supaIsOk, supabaseUrl, supabaseRef],
  );

  return (
    <View style={parentStyles.card}>
      <View style={s.cardHeader}>
        <Ionicons name="pulse-outline" size={18} color={theme.palette.primary} />
        <Text style={s.cardTitle}>Verbindungen</Text>
      </View>

      <StatusRow
        label="GitHub"
        ok={ghIsOk}
        accountName={githubUser || undefined}
        detailNode={
          ghIsOk ? (
            <View>
              <View style={s.scopesRow}>
                <Text style={s.detailLineLabel}>Scopes:</Text>
                {scopesInfo.unknown ? (
                  <ScopeBadge text="unknown" warn />
                ) : (
                  <View style={s.scopesWrap}>
                    {scopesInfo.scopes.slice(0, 8).map((sc) => (
                      <ScopeBadge key={sc} text={sc} />
                    ))}
                    {scopesInfo.scopes.length > 8 ? <ScopeBadge text={`+${scopesInfo.scopes.length - 8}`} /> : null}
                  </View>
                )}
              </View>
              {(!scopesInfo.unknown && scopesInfo.missing.length > 0) ? (
                <View style={s.missingRow}>
                  <Ionicons name="warning-outline" size={14} color={theme.palette.warning} />
                  <Text style={s.missingText}>Fehlen: {scopesInfo.missing.join(", ")} (PAT)</Text>
                </View>
              ) : null}
            </View>
          ) : undefined
        }
      />

      <StatusRow label="Expo" ok={expoOk ?? status.ex} accountName={expoUser || undefined} />

      <StatusRow
        label="Supabase"
        ok={supaIsOk}
        value={supaDisplay.value}
        detail={supaDisplay.detail}
      />

      <StatusRow label="Repo verknuepft" ok={status.linked} value={repoLine || undefined} />

      <StatusRow
        label="EAS Project"
        ok={easOk ?? status.eas}
        value={status.eas ? easProjectId : undefined}
        detail={easInitRunning ? "Workflow läuft… (GitHub Actions: eas-link)" : undefined}
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
          label="Build/CI"
          icon="construct-outline"
          variant="ghost"
          onPress={onNavigateBuild}
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
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "800",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.borderLight,
  },

  lightRow: {
    width: 18,
    alignItems: "center",
    paddingTop: 2,
  },
  light: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: theme.palette.border,
  },
  lightOn: {
    backgroundColor: theme.palette.success,
    shadowColor: theme.palette.success,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  lightLabel: {
    marginTop: 4,
    fontSize: 11,
    color: theme.palette.text.muted,
  },
  lightLabelOk: {
    color: theme.palette.success,
  },

  statusTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  statusLabel: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  accountName: {
    marginTop: 2,
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
  },

  detailNodeWrap: {
    marginTop: 6,
  },
  detailLineLabel: {
    color: theme.palette.text.muted,
    fontSize: 11,
    fontWeight: "700",
    marginRight: 6,
  },
  detailLine: {
    marginTop: 6,
    color: theme.palette.text.muted,
    fontSize: 11,
  },

  scopesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  scopesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },

  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeNeutral: {
    backgroundColor: theme.palette.cardHover,
    borderColor: theme.palette.border,
  },
  badgeNeutralText: {
    color: theme.palette.text.secondary,
  },
  badgeWarn: {
    backgroundColor: theme.palette.warning + "22",
    borderColor: theme.palette.warning,
  },
  badgeWarnText: {
    color: theme.palette.warning,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  missingRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  missingText: {
    color: theme.palette.warning,
    fontSize: 11,
    fontWeight: "700",
  },

  statusValue: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "800",
    maxWidth: 150,
  },

  statusBadge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  badgeOk: {
    backgroundColor: theme.palette.success + "22",
    color: theme.palette.success,
  },
  badgeFail: {
    backgroundColor: theme.palette.error + "22",
    color: theme.palette.error,
  },
});
