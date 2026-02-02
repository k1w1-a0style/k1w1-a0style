import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../theme";
import { useProject } from "../contexts/ProjectContext";
import { ensureSupabaseClient } from "../lib/supabase";
import { getEdgeAdminKey, saveEdgeAdminKey } from "../contexts/githubService";

type ModeId = "dev" | "preview" | "production";

type StatusResult = {
  exists: boolean;
  record?: {
    repo: string;
    mode: ModeId;
    alias: string;
    storage_bucket: string;
    storage_path: string;
    updated_at: string;
    created_at: string;
  };
};

type WizardHttpDebug = {
  url: string;
  status: number;
  statusText: string;
  bodyText: string;
};

const MODES: { id: ModeId; label: string; hint: string }[] = [
  { id: "dev", label: "Dev", hint: "Schnell testen (signed)" },
  { id: "preview", label: "Preview", hint: "Interne APK teilen (signed)" },
  { id: "production", label: "Produce", hint: "Release/Store (signed)" },
];

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
  payload: any
): Promise<{ ok: true; data: any; debug: WizardHttpDebug } | { ok: false; error: string; debug: WizardHttpDebug }> {
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-k1w1-admin-key": adminKey,
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

export default function CredentialsWizardScreen() {
  const project = useProject();

  const repoFullName = project?.linkedRepo ?? "";
  const branch = project?.linkedBranch ?? "";

  const [selectedMode, setSelectedMode] = useState<ModeId>("production");

  const [supabaseUrl, setSupabaseUrl] = useState<string>("");
  const [adminKey, setAdminKey] = useState<string>("");
  const [adminKeyLoaded, setAdminKeyLoaded] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);

  const [statusByMode, setStatusByMode] = useState<Record<ModeId, StatusResult | null>>({
    dev: null,
    preview: null,
    production: null,
  });

  const [lastDebug, setLastDebug] = useState<WizardHttpDebug | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

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

  function metaForStatus(s: StatusResult | null) {
    if (busy) return { icon: "time-outline" as const, text: "prüfe…", color: paletteTextMuted() };
    if (s?.exists) return { icon: "checkmark-circle-outline" as const, text: "Key vorhanden", color: paletteSuccess() };
    if (s && !s.exists) return { icon: "close-circle-outline" as const, text: "kein Key", color: paletteError() };
    return { icon: "help-circle-outline" as const, text: "unbekannt", color: paletteTextMuted() };
  }

  async function refreshStatus(mode: ModeId) {
    if (!canRun) {
      Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
      return;
    }
    setBusy(`status:${mode}`);
    setLastError(null);
    setLastDebug(null);
    try {
      const r = await invokeEdgeJson(supabaseUrl, "android-keystore-status", adminKey, {
        repo: repoFullName,
        mode,
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
      setBusy(null);
    }
  }

  async function refreshAll() {
    for (const m of MODES) {
      // eslint-disable-next-line no-await-in-loop
      await refreshStatus(m.id);
    }
  }

  async function generate(mode: ModeId) {
    if (!canRun) {
      Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
      return;
    }
    setBusy(`generate:${mode}`);
    setLastError(null);
    setLastDebug(null);
    try {
      const r = await invokeEdgeJson(supabaseUrl, "android-keystore-generate", adminKey, {
        repo: repoFullName,
        mode,
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

      Alert.alert("✅ Keystore erstellt", "Key wurde serverseitig erzeugt und gespeichert.");
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
    Alert.alert("✅ gespeichert", "Admin-Key lokal gespeichert (SecureStore).");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Credentials Wizard</Text>
      <Text style={styles.p}>Android Signing in‑App (Supabase + CI)</Text>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Projekt</Text>
        <Text style={styles.boxLine}>Repo: {repoFullName || "— (nicht verlinkt)"}</Text>
        <Text style={styles.boxLine}>Branch: {branch || "—"}</Text>
        <Text style={styles.boxLine}>Supabase: {supabaseUrl ? supabaseUrl.replace(/https:\/\//, "") : "—"}</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Edge Admin Key</Text>
        <Text style={styles.note}>
          Der Key wird **nicht** im Repo gespeichert. Du kannst ihn einmal hier setzen; er landet nur lokal im SecureStore.
        </Text>
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
        <View style={styles.row}>
          <Btn title="Save" onPress={onSaveAdminKey} primary />
          <Btn title="Refresh All" onPress={refreshAll} />
        </View>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Build‑Varianten</Text>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.modeRow, selectedMode === m.id && styles.modeRowActive]}
            onPress={() => setSelectedMode(m.id)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.modeLabel}>{m.label}</Text>
              <Text style={styles.modeHint}>{m.hint}</Text>
            </View>
            <Ionicons
              name={selectedMode === m.id ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={selectedMode === m.id ? theme.palette.primary : paletteTextMuted()}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.box}>
        <View style={styles.cardHeader}>
          <Ionicons name="key-outline" size={18} color={theme.palette.primary} />
          <Text style={styles.cardTitle}>Keystore Status</Text>
        </View>

        {MODES.map((m) => {
          const s = statusByMode[m.id];
          const meta = metaForStatus(s);
          const active = selectedMode === m.id;
          const line1 = s?.exists ? `Alias: ${s.record?.alias}` : "—";
          const line2 = s?.exists ? `Path: ${s.record?.storage_bucket}/${s.record?.storage_path}` : "—";

          return (
            <View key={m.id} style={[styles.statusRow, active && styles.statusRowActive]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>
                    {m.label}: <Text style={{ color: meta.color }}>{meta.text}</Text>
                  </Text>
                  <Text style={styles.metaLine}>{line1}</Text>
                  <Text style={styles.metaLine}>{line2}</Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Btn title="Status" onPress={() => refreshStatus(m.id)} small />
                <Btn title="Generate" onPress={() => generate(m.id)} small primary />
              </View>
            </View>
          );
        })}
      </View>

      {lastError ? <Text style={styles.warn}>❌ {lastError}</Text> : null}

      {lastDebug ? (
        <View style={styles.debugBox}>
          <Text style={styles.boxTitle}>Edge Debug</Text>
          <Text style={styles.debugText}>
            {JSON.stringify(
              { url: lastDebug.url, status: lastDebug.status, statusText: lastDebug.statusText, body: lastDebug.bodyText?.slice(0, 2500) },
              null,
              2
            )}
          </Text>
        </View>
      ) : null}

      {busy ? <Text style={styles.busyText}>⏳ {busy}</Text> : null}
    </ScrollView>
  );
}

function Btn({
  title,
  onPress,
  primary,
  small,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  primary?: boolean;
  small?: boolean;
}) {
  const isPrimary = Boolean(primary);
  return (
    <TouchableOpacity
      onPress={() => void onPress()}
      style={[
        styles.btn,
        small && styles.btnSmall,
        isPrimary ? styles.btnPrimary : styles.btnSecondary,
      ]}
      activeOpacity={0.85}
    >
      <Text style={[styles.btnText, { color: isPrimary ? theme.palette.text.inverse : theme.palette.text.primary }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background.default },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "700", color: theme.palette.text.primary, marginBottom: 8 },
  p: { color: theme.palette.text.primary, marginBottom: 12 },
  warn: { color: theme.palette.warning, marginTop: 8 },
  row: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },

  box: {
    borderWidth: 1,
    borderColor: theme.palette.border.default,
    backgroundColor: theme.palette.card.default,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  boxTitle: { fontWeight: "700", color: theme.palette.text.primary, marginBottom: 6 },
  boxLine: { color: theme.palette.text.muted, marginBottom: 2 },
  note: { color: theme.palette.text.muted, marginTop: 4, marginBottom: 10 },

  input: {
    borderWidth: 1,
    borderColor: theme.palette.border.default,
    backgroundColor: theme.palette.background.default,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.palette.text.primary,
  },

  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.palette.border.default,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.palette.background.default,
    marginBottom: 10,
  },
  modeRowActive: {
    borderColor: theme.palette.primary,
    shadowColor: theme.palette.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modeLabel: { fontWeight: "700", color: theme.palette.text.primary, fontSize: 16 },
  modeHint: { color: theme.palette.text.muted, marginTop: 2 },

  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { fontWeight: "700", color: theme.palette.text.primary, marginLeft: 8 },

  statusRow: {
    borderWidth: 1,
    borderColor: theme.palette.border.default,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: theme.palette.background.default,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  statusRowActive: {
    borderColor: theme.palette.primary,
  },
  statusTitle: { color: theme.palette.text.primary, fontWeight: "700" },
  metaLine: { color: theme.palette.text.muted, fontSize: 12, marginTop: 2 },

  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 110,
    alignItems: "center",
  },
  btnSmall: { minWidth: 90, paddingVertical: 8 },
  btnText: { fontWeight: "700" },
  btnPrimary: { backgroundColor: theme.palette.primary },
  btnSecondary: { backgroundColor: theme.palette.card.default, borderWidth: 1, borderColor: theme.palette.border.default },

  debugBox: {
    borderWidth: 1,
    borderColor: theme.palette.border.default,
    backgroundColor: theme.palette.card.default,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  debugText: { fontFamily: "monospace", fontSize: 12, color: theme.palette.text.muted },
  busyText: { color: theme.palette.text.muted, marginTop: 8 },
});
