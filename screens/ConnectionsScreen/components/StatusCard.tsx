import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import type { VerificationContractState } from "../../../lib/status/verificationContract";
import type { ConnectionsStyles } from "./types";
import { ActionButton } from "./ActionButton";
import {
  formatGitHubScopes,
  formatSupabaseDisplay,
  resolveEasVerificationPresentation,
  shouldRenderGitHubScopes,
} from "./StatusCard.helpers";

import { s } from "./StatusCard.styles";

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
  stateLabel?: string;
  stateTone?: "ok" | "warn" | "neutral" | "error";
  accountName?: string;
  detail?: string;
  detailNode?: React.ReactNode;
}) {
  const { label, ok, value, stateLabel, stateTone = ok ? "ok" : "error", accountName, detail, detailNode } = props;
  const stateStyle =
    stateTone === "ok"
      ? s.badgeOk
      : stateTone === "warn"
        ? s.statusBadgeWarn
        : stateTone === "neutral"
          ? s.statusBadgeNeutral
          : s.badgeFail;
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
      <View style={s.statusValueWrap}>
        {value ? (
          <Text style={s.statusValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {(!value || stateLabel) ? (
          <Text style={[s.statusBadge, stateStyle]}>
            {stateLabel || (ok ? "OK" : "FEHLT")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function StatusCard(props: {
  styles: ConnectionsStyles;
  busy: boolean;
  status: {
    gh: boolean;
    ex: boolean;
    edge: boolean;
    sbUrl: boolean;
    sbAnon: boolean;
    linked: boolean;
    eas: boolean;
  };
  repoLine: string;
  selectionSource?: "project" | "context" | "none";
  supabaseUrl: string;
  supabaseRef?: string;
  easProjectId: string;
  easLastVerifiedAt?: string | null;
  githubOk?: boolean;
  githubUser?: string;
  githubScopes?: string;
  supabaseOk?: boolean;
  expoOk?: boolean;
  expoUser?: string;
  easOk?: boolean;
  easState?: VerificationContractState;
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
    selectionSource = "none",
    supabaseUrl,
    supabaseRef,
    easProjectId,
    easLastVerifiedAt,
    githubOk,
    githubUser,
    githubScopes,
    supabaseOk,
    expoOk,
    expoUser,
    easOk,
    easState,
    easInitRunning,
    onNavigateRepos,
    onNavigateDiagnostic,
    onNavigateBuild,
  } = props;

  const ghIsOk = githubOk ?? status.gh;
  const scopesInfo = useMemo(() => formatGitHubScopes(githubScopes), [githubScopes]);
  const showGitHubScopes = useMemo(
    () => shouldRenderGitHubScopes(githubScopes),
    [githubScopes],
  );

  const repoSelectionHint =
    selectionSource === "project"
      ? "Aktive Projektauswahl (gespeichert)"
      : selectionSource === "context"
        ? "Letzte Context-Auswahl (nicht gespeichert)"
        : "Keine Auswahl";

  const repoSelectionDetail =
    selectionSource === "project"
      ? `${repoSelectionHint} · Maßgeblich für Build/Signing.`
      : selectionSource === "context"
        ? `${repoSelectionHint} · Nur letzter bekannter Stand; erst nach Verknüpfen im Projekt wirklich wirksam.`
        : "In GitHub Repos auswählen.";

  const easStatusDetail = useMemo(
    () =>
      resolveEasVerificationPresentation({
        easInitRunning,
        easProjectId,
        easState:
          easState ??
          (easOk ? "verified" : status.eas ? "stale" : "missing"),
        easLastVerifiedAt,
      }),
    [easInitRunning, easProjectId, easLastVerifiedAt, easOk, easState, status.eas],
  );

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
                {showGitHubScopes ? (
                  <View style={s.scopesWrap}>
                    {scopesInfo.scopes.slice(0, 8).map((sc) => (
                      <ScopeBadge key={sc} text={sc} />
                    ))}
                    {scopesInfo.scopes.length > 8 ? <ScopeBadge text={`+${scopesInfo.scopes.length - 8}`} /> : null}
                  </View>
                ) : null}
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

      <StatusRow
        label="Aktives Repo / Branch"
        ok={status.linked}
        value={repoLine || undefined}
        detail={repoLine ? repoSelectionDetail : "In GitHub Repos auswählen."}
      />

      <StatusRow
        label="EAS Project"
        ok={easStatusDetail.ok}
        value={status.eas ? easProjectId : undefined}
        stateLabel={easStatusDetail.stateLabel}
        stateTone={easStatusDetail.stateTone}
        detail={easStatusDetail.detail}
      />

      <View style={parentStyles.row}>
        <ActionButton
          styles={parentStyles}
          busy={busy}
          label="Repos"
          icon="logo-github"
          testID="connections-status-go-repos-button"
          onPress={onNavigateRepos}
        />
        <ActionButton
          styles={parentStyles}
          busy={busy}
          label="Build/CI"
          icon="construct-outline"
          variant="ghost"
          testID="connections-status-go-build-button"
          onPress={onNavigateBuild}
        />
        <ActionButton
          styles={parentStyles}
          busy={busy}
          label="Diagnose"
          icon="flask-outline"
          variant="ghost"
          testID="connections-status-go-diagnostic-button"
          onPress={onNavigateDiagnostic}
        />
      </View>
    </View>
  );
}

export {
  buildEasStatusDetail,
  formatGitHubScopes,
  formatSupabaseDisplay,
  resolveEasVerificationPresentation,
  shouldRenderGitHubScopes,
} from "./StatusCard.helpers";
