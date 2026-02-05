import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";

import { theme } from "../theme";
import { useProject } from "../contexts/ProjectContext";
import { ensureSupabaseClient } from "../lib/supabase";
import { getEdgeAdminKey, saveEdgeAdminKey } from "../contexts/githubService";

import { SectionCard } from "../components/diagnostics/SectionCard";
import { InlineToast } from "../components/diagnostics/InlineToast";
import { useInlineToast } from "../components/diagnostics/useInlineToast";

// UI nennt es "dev" – Backend erwartet "development".
type UiModeId = "dev" | "preview" | "production";
type ApiModeId = "development" | "preview" | "production";

type StatusResult = {
  exists: boolean;
  // NOTE: Backend-Response wurde geändert. Wir unterstützen beides (neu + legacy),
  // damit die App auch nach Edge-Deploys stabil bleibt.
  record?: {
    repo?: string;
    // Backend liefert z.B. "development"; UI arbeitet mit "dev".
    mode?: UiModeId | ApiModeId;
    alias?: string;
    // legacy
    storage_bucket?: string;
    storage_path?: string;
    updated_at?: string;
    created_at?: string;
    // new
    updatedAt?: string;
    storage?: {
      bucket?: string;
      path?: string;
      exists?: boolean;
    };
  };
};

type WizardHttpDebug = {
  url: string;
  status: number;
  statusText: string;
  bodyText: string;
};

const MODES: { id: UiModeId; label: string; hint: string }[] = [
  { id: "dev", label: "Dev", hint: "Schnell testen (signed)" },
  { id: "preview", label: "Preview", hint: "Interne APK teilen (signed)" },
  { id: "production", label: "Production", hint: "Release/Store (signed)" },
];

function normalizeModeForApi(mode: UiModeId): ApiModeId {
  return mode === "dev" ? "development" : mode;
}

function normalizeModeForUi(mode?: string): UiModeId | undefined {
  if (!mode) return undefined;
  if (mode === "development") return "dev";
  if (mode === "preview" || mode === "production" || mode === "dev") return mode as UiModeId;
  return undefined;
}

function pickStorageBucket(record?: StatusResult["record"]) {
  return record?.storage?.bucket ?? record?.storage_bucket;
}

function pickStoragePath(record?: StatusResult["record"]) {
  return record?.storage?.path ?? record?.storage_path;
}

function pickUpdatedAt(record?: StatusResult["record"]) {
  return record?.updatedAt ?? record?.updated_at;
}

function paletteTextMuted() {
  return theme.palette.text.muted;
}

function paletteSuccess() {
  return theme.palette.success;
}

function paletteError() {
  return theme.palette.error;
}

async function invokeEdgeJson(
  supabaseUrl: string,
  fn: string,
  adminKey: string,
  payload: any,
): Promise<{ ok: true; data: any; debug: WizardHttpDebug } | { ok: false; error: string; debug: WizardHttpDebug }> {
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Defensive: trim to avoid accidental whitespace/newlines from copy/paste.
      "x-k1w1-admin-key": adminKey.trim(),
    },
    body: JSON.stringify(payload ?? {}),
  });

  const bodyText = await res.text();
  const debug: WizardHttpDebug = { url, status: res.status, statusText: res.statusText ?? "", bodyText };

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status} ${res.statusText || ""}`.trim(), debug };
  }

  try {
    const data = bodyText ? JSON.parse(bodyText) : null;
    return { ok: true, data, debug };
  } catch {
    return { ok: true, data: bodyText, debug };
  }
}

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CredentialsWizardScreen() {
  const project = useProject();
  const toast = useInlineToast();

  // Repo/Branch niemals "fest pinnen" – immer aus dem aktuell verlinkten Projekt holen.
  const repoFullName = project?.projectData?.linkedRepo ?? "";
  const branch = project?.projectData?.linkedBranch ?? "";

  const [selectedMode, setSelectedMode] = useState<UiModeId>("production");

  const [supabaseUrl, setSupabaseUrl] = useState<string>("");
  const [adminKey, setAdminKey] = useState<string>("");
  const [adminKeyLoaded, setAdminKeyLoaded] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);

  const [statusByMode, setStatusByMode] = useState<Record<UiModeId, StatusResult | null>>({
    dev: null,
    preview: null,
    production: null,
  });

  const [lastDebug, setLastDebug] = useState<WizardHttpDebug | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showError, setShowError] = useState(false);

  const runningRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const client = await ensureSupabaseClient();
        if (!mounted) return;
        // supabase-js client exposes supabaseUrl
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = (client as any)?.supabaseUrl as string | undefined;
        if (url) setSupabaseUrl(url);
      } catch (e: any) {
        if (!mounted) return;
        setLastError(e?.message ?? String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const k = await getEdgeAdminKey();
        if (!mounted) return;
        if (k) setAdminKey(k);
      } finally {
        if (mounted) setAdminKeyLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const canRun = useMemo(() => {
    return Boolean(supabaseUrl && adminKey && repoFullName);
  }, [supabaseUrl, adminKey, repoFullName]);

  const selectedStatus = statusByMode[selectedMode];

  const prettyDebug = useMemo(() => {
    if (!lastDebug) return "";
    try {
      return JSON.stringify(lastDebug, null, 2);
    } catch {
      return String(lastDebug);
    }
  }, [lastDebug]);

  const prettyError = useMemo(() => {
    if (!lastError) return "";
    return String(lastError);
  }, [lastError]);

  function metaForStatus(s: StatusResult | null, mode: UiModeId) {
    const isBusy = busy === `status:${mode}`;
    if (isBusy) return { icon: "time-outline" as const, text: "prüfe…", color: paletteTextMuted() };
    if (s?.exists) return { icon: "checkmark-circle-outline" as const, text: "Key vorhanden", color: paletteSuccess() };
    if (s && !s.exists) return { icon: "close-circle-outline" as const, text: "kein Key", color: paletteError() };
    return { icon: "help-circle-outline" as const, text: "unbekannt", color: paletteTextMuted() };
  }

  async function refreshStatus(mode: UiModeId) {
    if (!canRun) {
      Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
      return;
    }

    // Prevent stacked calls on bad networks.
    if (runningRef.current) return;
    runningRef.current = true;

    setBusy(`status:${mode}`);
    setLastError(null);
    setLastDebug(null);

    try {
      const apiMode = normalizeModeForApi(mode);
      const r = await invokeEdgeJson(supabaseUrl, "android-keystore-status", adminKey, {
        repo: repoFullName,
        mode: apiMode,
      });

      setLastDebug(r.debug);
      if (!r.ok) {
        setLastError(r.error);
        setStatusByMode((prev) => ({ ...prev, [mode]: { exists: false } }));
        return;
      }

      const data = r.data as StatusResult;
      setStatusByMode((prev) => ({ ...prev, [mode]: data }));
    } catch (e: any) {
      setLastError(e?.message ?? String(e));
    } finally {
      runningRef.current = false;
      setBusy(null);
    }
  }

  async function refreshAll() {
    if (!canRun) {
      Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
      return;
    }
    setBusy("status:all");
    setLastError(null);
    setLastDebug(null);

    try {
      // sequential, stable, avoids rate-limit bursts
      // eslint-disable-next-line no-restricted-syntax
      for (const m of MODES) {
        // eslint-disable-next-line no-await-in-loop
        await refreshStatus(m.id);
      }
      toast.show("Status aktualisiert");
    } finally {
      setBusy(null);
    }
  }

  async function generate(mode: UiModeId) {
    if (!canRun) {
      Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
      return;
    }

    setBusy(`generate:${mode}`);
    setLastError(null);
    setLastDebug(null);

    try {
      const apiMode = normalizeModeForApi(mode);
      const r = await invokeEdgeJson(supabaseUrl, "android-keystore-generate", adminKey, {
        repo: repoFullName,
        mode: apiMode,
        // optional: branch rein, damit du später mehr Kontext hast (DB key bleibt repo+mode)
        branch: branch || undefined,
      });

      setLastDebug(r.debug);
      if (!r.ok) {
        setLastError(r.error);
        return;
      }

      if (r.data?.ok === false) {
        setLastError(r.data?.error ?? "Generate fehlgeschlagen");
        return;
      }

      toast.show("Keystore erstellt");
      await refreshStatus(mode);
    } catch (e: any) {
      setLastError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onSaveAdminKey() {
    const trimmed = adminKey.trim();
    setAdminKey(trimmed);
    await saveEdgeAdminKey(trimmed);
    toast.show("Admin-Key gespeichert");
  }

  const modeHint = useMemo(() => MODES.find((m) => m.id === selectedMode)?.hint ?? "", [selectedMode]);

  const headerSubtitle = useMemo(() => {
    if (!repoFullName) return "Repo nicht verlinkt";
    const b = branch ? ` · ${branch}` : "";
    return `${repoFullName}${b}`;
  }, [repoFullName, branch]);

  return (
    <View style={styles.root}>
      <InlineToast message={toast.message} anim={toast.anim} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.h1}>Credentials Wizard</Text>
          <Text style={styles.p}>Android Signing (Supabase + CI)</Text>
          <View style={styles.headerMeta}>
            <Ionicons name="git-branch-outline" size={14} color={theme.palette.text.secondary} />
            <Text style={styles.headerMetaText}>{headerSubtitle}</Text>
          </View>
        </View>

        <SectionCard
          title="Project"
          subtitle="Source of truth: linked repo + Supabase client"
          icon="cube-outline"
          right={
            <Chip
              label={repoFullName ? "Linked" : "Not linked"}
              tone={repoFullName ? "success" : "muted"}
            />
          }
        >
          <KeyValue label="Repo" value={repoFullName || "—"} />
          <KeyValue label="Branch" value={branch || "—"} />
          <KeyValue label="Supabase" value={supabaseUrl ? supabaseUrl.replace(/https:\/\//, "") : "—"} />
        </SectionCard>

        <Spacer />

        <SectionCard
          title="Edge Admin Key"
          subtitle="Local only (SecureStore) — not committed to git"
          icon="key-outline"
          right={
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowAdvanced((v) => !v);
              }}
              style={styles.advancedBtn}
              activeOpacity={0.85}
            >
              <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={16} color={theme.palette.text.primary} />
              <Text style={styles.advancedBtnText}>{showAdvanced ? "Hide" : "Advanced"}</Text>
            </TouchableOpacity>
          }
        >
          <TextInput
            value={adminKey}
            onChangeText={setAdminKey}
            placeholder={adminKeyLoaded ? "SIGNING_ADMIN_KEY einfügen…" : "lade…"}
            placeholderTextColor={paletteTextMuted()}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={styles.actionRow}>
            <PrimaryButton title="Save" onPress={onSaveAdminKey} disabled={!adminKey.trim()} />
            <SecondaryButton title="Refresh all" onPress={refreshAll} disabled={!canRun || Boolean(busy)} />
          </View>

          {showAdvanced ? (
            <View style={styles.advancedBox}>
              <InlineHint
                icon="information-circle-outline"
                text="Tipp: Wenn du nach Copy/Paste plötzlich 401 bekommst: Key nochmal speichern (trim)."
              />
              <InlineHint
                icon="shield-checkmark-outline"
                text="Admin-Key bleibt lokal. Wenn du das Gerät wechselst, musst du ihn neu setzen."
              />
            </View>
          ) : null}
        </SectionCard>

        <Spacer />

        <SectionCard title="Mode" subtitle={modeHint} icon="layers-outline">
          <ModeSegmented value={selectedMode} onChange={setSelectedMode} />

          <View style={styles.modeActions}>
            <SecondaryButton
              title="Check status"
              onPress={() => refreshStatus(selectedMode)}
              disabled={!canRun || Boolean(busy)}
              leftIcon="pulse-outline"
            />
            <PrimaryButton
              title="Generate"
              onPress={() => generate(selectedMode)}
              disabled={!canRun || Boolean(busy)}
              leftIcon="sparkles-outline"
            />
          </View>
        </SectionCard>

        <Spacer />

        <SectionCard title="Keystore Status" subtitle="Per mode" icon="checkmark-done-outline">
          {MODES.map((m) => {
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
                    Updated: <Text style={styles.kvValue}>{s?.exists ? updatedLine : "—"}</Text>
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
                  <TertiaryButton
                    title="Status"
                    onPress={() => refreshStatus(m.id)}
                    disabled={!canRun || Boolean(busy)}
                  />
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

        {(lastError || lastDebug) ? <Spacer /> : null}

        {lastError ? (
          <SectionCard
            title="Error"
            subtitle="Letzte Anfrage"
            icon="alert-circle-outline"
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={async () => {
                    await Clipboard.setStringAsync(prettyError);
                    toast.show("Fehler kopiert");
                  }}
                  style={styles.iconBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="copy-outline" size={16} color={theme.palette.text.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setShowError((v) => !v);
                  }}
                  style={styles.iconBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name={showError ? "chevron-up" : "chevron-down"} size={16} color={theme.palette.text.primary} />
                </TouchableOpacity>
              </View>
            }
          >
            <InlineHint icon="close-circle-outline" tone="danger" text={lastError} />
            {showError ? (
              <View style={styles.codeBox}>
                <Text selectable style={styles.codeText}>{prettyError}</Text>
              </View>
            ) : null}
          </SectionCard>
        ) : null}

        {lastDebug ? (
          <>
            <Spacer />
            <SectionCard
              title="Request Debug"
              subtitle="URL + status + body"
              icon="bug-outline"
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={async () => {
                      await Clipboard.setStringAsync(prettyDebug);
                      toast.show("Debug kopiert");
                    }}
                    style={styles.iconBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.palette.text.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setShowDebug((v) => !v);
                    }}
                    style={styles.iconBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={showDebug ? "chevron-up" : "chevron-down"} size={16} color={theme.palette.text.primary} />
                  </TouchableOpacity>
                </View>
              }
            >
              <Text style={styles.mutedLine} numberOfLines={2}>
                {lastDebug.url}
              </Text>
              <Text style={styles.mutedLine}>HTTP {lastDebug.status} {lastDebug.statusText || ""}</Text>

              {showDebug ? (
                <View style={styles.codeBox}>
                  <Text selectable style={styles.codeText}>{prettyDebug}</Text>
                </View>
              ) : null}
            </SectionCard>
          </>
        ) : null}

        {busy ? (
          <View style={styles.footerBusy}>
            <Ionicons name="time-outline" size={16} color={theme.palette.text.secondary} />
            <Text style={styles.footerBusyText}>{busy}</Text>
          </View>
        ) : null}

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

function Spacer() {
  return <View style={{ height: theme.spacing.md }} />;
}

function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "muted";
}) {
  const bg = tone === "success" ? "rgba(0,255,0,0.10)" : "rgba(255,255,255,0.06)";
  const border = tone === "success" ? "rgba(0,255,0,0.25)" : theme.palette.border;
  const color = tone === "success" ? theme.palette.text.primary : theme.palette.text.secondary;
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function InlineHint({
  icon,
  text,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: "muted" | "warning" | "danger";
}) {
  const color =
    tone === "danger" ? theme.palette.error : tone === "warning" ? theme.palette.warning : theme.palette.text.secondary;

  return (
    <View style={styles.inlineHint}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.inlineHintText, { color }]}>{text}</Text>
    </View>
  );
}

function ModeSegmented({ value, onChange }: { value: UiModeId; onChange: (v: UiModeId) => void }) {
  return (
    <View style={styles.segmentWrap}>
      {MODES.map((m) => {
        const on = m.id === value;
        return (
          <TouchableOpacity
            key={m.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            activeOpacity={0.9}
            onPress={() => {
              if (m.id === value) return;
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onChange(m.id);
            }}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{m.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled,
  small,
  leftIcon,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  small?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      activeOpacity={0.86}
      style={[styles.btn, small && styles.btnSmall, styles.btnPrimary, disabled && styles.btnDisabled]}
    >
      {leftIcon ? <Ionicons name={leftIcon} size={16} color="#06120a" /> : null}
      <Text style={[styles.btnText, { color: "#06120a" }]}>{title}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({
  title,
  onPress,
  disabled,
  leftIcon,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      activeOpacity={0.86}
      style={[styles.btn, styles.btnSecondary, disabled && styles.btnDisabled]}
    >
      {leftIcon ? <Ionicons name={leftIcon} size={16} color={theme.palette.text.primary} /> : null}
      <Text style={[styles.btnText, { color: theme.palette.text.primary }]}>{title}</Text>
    </TouchableOpacity>
  );
}

function TertiaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      activeOpacity={0.86}
      style={[styles.btn, styles.btnTertiary, disabled && styles.btnDisabled]}
    >
      <Text style={[styles.btnText, { color: theme.palette.text.secondary }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1, backgroundColor: theme.palette.background },
  content: {
    padding: theme.layout.screenPadding,
    paddingBottom: 140,
  },

  header: {
    marginBottom: theme.spacing.md,
  },
  h1: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  p: {
    color: theme.palette.text.secondary,
    marginTop: 6,
  },
  headerMeta: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerMetaText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    flex: 1,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "900",
  },

  kvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.palette.border,
  },
  kvLabel: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  kvValue: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "800",
    maxWidth: "70%",
    textAlign: "right",
  },
  kvMuted: {
    color: theme.palette.text.secondary,
    fontSize: 12,
  },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: theme.palette.text.primary,
    fontSize: 14,
  },

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },

  btn: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnSmall: {
    minHeight: 38,
    paddingVertical: 8,
  },
  btnText: {
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  btnPrimary: {
    backgroundColor: theme.palette.primary,
  },
  btnSecondary: {
    backgroundColor: theme.palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  btnTertiary: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  advancedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  advancedBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  advancedBox: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.border,
    gap: 8,
  },

  segmentWrap: {
    flexDirection: "row",
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentOn: {
    backgroundColor: theme.palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.borderLight,
  },
  segmentText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 13,
  },
  segmentTextOn: {
    color: theme.palette.text.primary,
  },

  modeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },

  statusRow: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    borderRadius: theme.borderRadius.lg,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  statusRowActive: {
    borderColor: "rgba(0,255,0,0.35)",
    backgroundColor: "rgba(0,255,0,0.05)",
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  statusTitle: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  statusMeta: {
    fontSize: 12,
    fontWeight: "900",
  },

  inlineHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineHintText: {
    fontSize: 12,
    flex: 1,
  },

  notice: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,170,0,0.35)",
    backgroundColor: "rgba(255,170,0,0.06)",
  },
  noticeText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    flex: 1,
  },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },

  mutedLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },

  codeBox: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: theme.spacing.md,
  },
  codeText: {
    color: theme.palette.text.primary,
    fontFamily: theme.typography.monoFamily,
    fontSize: 12,
    lineHeight: 16,
  },

  footerBusy: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  footerBusyText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
  },
});
