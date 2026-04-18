import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import {
  normalizeVerificationContract,
  type VerificationContractState,
} from "../../../lib/status/verificationContract";
import type { ConnectionsStyles } from "./types";
import { ActionButton } from "./ActionButton";

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

export function formatGitHubScopes(scopesRaw?: string): { scopes: string[]; missing: string[]; unknown: boolean } {
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

export function shouldRenderGitHubScopes(scopesRaw?: string): boolean {
  return !formatGitHubScopes(scopesRaw).unknown;
}

export function buildEasStatusDetail(params: {
  easInitRunning?: boolean;
  easProjectId?: string;
  easState?: VerificationContractState;
  easLastVerifiedAt?: string | null;
}): string {
  const easProjectId = String(params.easProjectId ?? "").trim();
  if (params.easInitRunning) return "Verknüpfung läuft… (GitHub Actions: eas-link)";
  if (!easProjectId) return "Keine EAS Project ID gespeichert.";
  if (params.easState === "verified") {
    if (params.easLastVerifiedAt) {
      const ts = new Date(params.easLastVerifiedAt);
      const readable = Number.isNaN(ts.getTime()) ? params.easLastVerifiedAt : ts.toLocaleString();
      return `Frisch verifiziert: ${readable}`;
    }
    return "Projekt-ID gespeichert, aber noch nicht frisch verifiziert.";
  }
  if (params.easState === "stale") {
    return "Projekt-ID vorhanden, aber der letzte erfolgreiche Check ist nicht mehr frisch.";
  }
  if (params.easState === "auth_error") {
    return "Projekt-ID vorhanden, aber Expo/EAS konnte sie mit diesem Login nicht bestaetigen.";
  }
  return "Projekt-ID vorhanden, aber aktuell nicht sicher verifizierbar.";
}

export function resolveEasVerificationPresentation(params: {
  easInitRunning?: boolean;
  easProjectId?: string;
  easState?: VerificationContractState | null;
  easLastVerifiedAt?: string | null;
}): {
  contractState: VerificationContractState;
  ok: boolean;
  stateLabel: string;
  stateTone: "ok" | "warn" | "neutral" | "error";
  detail: string;
} {
  const contract = normalizeVerificationContract({
    configured: !!String(params.easProjectId ?? "").trim(),
    stale: params.easState === "stale",
    verified: params.easState === "verified",
    explicitState: params.easState ?? undefined,
  });

  const stateLabel =
    contract.state === "verified"
      ? "OK"
      : contract.state === "missing"
        ? "FEHLT"
        : contract.state === "auth_error"
          ? "ZUGRIFF"
          : contract.state === "stale"
            ? "ALT"
            : "UNKLAR";

  const stateTone =
    contract.state === "verified"
      ? "ok"
      : contract.state === "missing"
        ? "error"
        : contract.state === "auth_error"
          ? "warn"
          : "neutral";

  return {
    contractState: contract.state,
    ok: contract.isVerified,
    stateLabel,
    stateTone,
    detail: buildEasStatusDetail({
      easInitRunning: params.easInitRunning,
      easProjectId: params.easProjectId,
      easState: contract.state,
      easLastVerifiedAt: params.easLastVerifiedAt,
    }),
  };
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
