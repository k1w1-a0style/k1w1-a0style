import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../theme";
import { ensureSupabaseClient } from "../lib/supabase";
import { useProject } from "../contexts/ProjectContext";
import { getEdgeAdminKey, getSupabaseServiceRoleKey } from "../contexts/githubService";

type BuildVariant = "development" | "preview" | "production";

type VariantMeta = {
  id: BuildVariant;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  note: string;
};

type VariantStatus = {
  loading: boolean;
  exists: boolean;
  updatedAt?: string | null;
  storagePath?: string | null;
  alias?: string | null;
  fingerprint?: string | null;
};

const VARIANTS: VariantMeta[] = [
  {
    id: "development",
    title: "Dev",
    icon: "construct-outline",
    note: "Signed Dev-Build (intern). Gut für schnelle Tests, aber trotzdem reproduzierbar.",
  },
  {
    id: "preview",
    title: "Preview",
    icon: "eye-outline",
    note: "Signed Preview (intern). Wie Staging – gleiche Signatur-Logik wie Prod.",
  },
  {
    id: "production",
    title: "Production",
    icon: "shield-checkmark-outline",
    note: "Signed Production. Das ist dein „echtes“ Release-Signing.",
  },
];

function safeString(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function compactJson(obj: any, maxLen = 1200): string {
  try {
    const s = JSON.stringify(obj, null, 2);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "\n…(truncated)";
  } catch {
    return String(obj);
  }
}

async function invokeEdgeJson<T>(
  functionName: string,
  payload: any,
  adminKey: string | null,
  serviceRoleKey: string | null
): Promise<T> {
  const supabase = ensureSupabaseClient();

  // We call via raw fetch to always capture status/body (supabase-js hides it on non-2xx).
  const supabaseUrl = supabase?.supabaseUrl;
  if (!supabaseUrl) throw new Error("Supabase URL missing (client not initialized).");

  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  // Admin key is our own "tooling" gate.
  if (adminKey) headers["x-k1w1-admin-key"] = adminKey;

  // Service role key is needed by the Edge function to access DB/Storage.
  // (Internal tooling only – do NOT ship this to public end-user apps.)
  if (serviceRoleKey) {
    headers["authorization"] = `Bearer ${serviceRoleKey}`;
    headers["apikey"] = serviceRoleKey; // some gateways expect this
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload ?? {}),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err: any = new Error("Edge Function returned a non-2xx status code");
    err.name = "FunctionsHttpError";
    err.context = {
      status: res.status,
      statusText: res.statusText,
      url,
      body: json,
      headers: Object.fromEntries(res.headers.entries()),
    };
    throw err;
  }

  return json as T;
}

function VariantCard({
  meta,
  status,
  onStatus,
  onGenerate,
  onExport,
}: {
  meta: VariantMeta;
  status: VariantStatus;
  onStatus: () => void;
  onGenerate: () => void;
  onExport: () => void;
}) {
  const badge = status.loading
    ? { icon: "time-outline" as const, text: "prüfe…", color: theme.colors.textMuted }
    : status.exists
      ? { icon: "checkmark-circle-outline" as const, text: "Key vorhanden", color: theme.colors.success }
      : { icon: "close-circle-outline" as const, text: "kein Key", color: theme.colors.error };

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <Ionicons name={meta.icon} size={18} color={theme.colors.primary} />
          <Text style={styles.cardTitle}>{meta.title}</Text>
        </View>

        <View style={styles.row}>
          <Ionicons name={badge.icon} size={16} color={badge.color} />
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
        </View>
      </View>

      <Text style={styles.note}>{meta.note}</Text>

      {status.exists ? (
        <View style={styles.metaBox}>
          {!!status.updatedAt && (
            <Text style={styles.metaLine}>Updated: {String(status.updatedAt)}</Text>
          )}
          {!!status.fingerprint && (
            <Text style={styles.metaLine}>Fingerprint: {String(status.fingerprint).slice(0, 24)}…</Text>
          )}
          {!!status.storagePath && (
            <Text style={styles.metaLine}>Storage: {String(status.storagePath)}</Text>
          )}
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <ActionButton
          title="Status"
          icon="pulse-outline"
          onPress={onStatus}
          variant="secondary"
        />
        <ActionButton
          title="Key generieren"
          icon="key-outline"
          onPress={onGenerate}
          variant="primary"
        />
        <ActionButton
          title="Export (CI)"
          icon="cloud-download-outline"
          onPress={onExport}
          variant="secondary"
        />
      </View>
    </View>
  );
}

function ActionButton({
  title,
  icon,
  onPress,
  variant,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      style={[styles.btn, isPrimary ? styles.btnPrimary : styles.btnSecondary]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons
        name={icon}
        size={16}
        color={isPrimary ? theme.colors.textOnPrimary : theme.colors.text}
      />
      <Text style={[styles.btnText, { color: isPrimary ? theme.colors.textOnPrimary : theme.colors.text }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function CredentialsWizardScreen() {
  const project = useProject();

  const repoFullName = project?.project?.github?.full_name ?? null;
  const branch = project?.project?.github?.branch ?? null;

  const [busy, setBusy] = useState(false);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [serviceRoleKey, setServiceRoleKey] = useState<string | null>(null);

  const [statusMap, setStatusMap] = useState<Record<BuildVariant, VariantStatus>>(() => ({
    development: { loading: false, exists: false },
    preview: { loading: false, exists: false },
    production: { loading: false, exists: false },
  }));

  const [lastDebug, setLastDebug] = useState<string>("");

  const canRun = useMemo(() => {
    return !!repoFullName && !!adminKey && !!serviceRoleKey;
  }, [repoFullName, adminKey, serviceRoleKey]);

  const loadKeys = useCallback(async () => {
    const k = await getEdgeAdminKey().catch(() => null);
    const s = await getSupabaseServiceRoleKey().catch(() => null);
    setAdminKey(safeString(k));
    setServiceRoleKey(safeString(s));
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const setVariantLoading = (variant: BuildVariant, loading: boolean) => {
    setStatusMap((prev) => ({
      ...prev,
      [variant]: { ...prev[variant], loading },
    }));
  };

  const setVariantData = (variant: BuildVariant, data: Partial<VariantStatus>) => {
    setStatusMap((prev) => ({
      ...prev,
      [variant]: { ...prev[variant], ...data },
    }));
  };

  const formatEdgeError = async (e: any) => {
    const ctx = e?.context;
    const minimal = {
      name: e?.name,
      message: e?.message,
      status: ctx?.status,
      url: ctx?.url,
      body: ctx?.body,
    };
    setLastDebug(compactJson({ minimal, full: { context: ctx } }, 4000));
    return compactJson(minimal, 1200);
  };

  const runStatus = useCallback(
    async (variant: BuildVariant) => {
      if (!repoFullName) {
        Alert.alert("Repo fehlt", "Bitte zuerst ein GitHub Repo im Projekt verbinden.");
        return;
      }
      setVariantLoading(variant, true);
      try {
        const data: any = await invokeEdgeJson(
          "android-keystore-status",
          { repo: repoFullName, branch, profile: variant, mode: variant },
          adminKey,
          serviceRoleKey
        );
        setVariantData(variant, {
          loading: false,
          exists: !!data?.exists,
          updatedAt: data?.updated_at ?? data?.updatedAt ?? null,
          storagePath: data?.storage_path ?? data?.storagePath ?? null,
          alias: data?.key_alias ?? data?.alias ?? null,
          fingerprint: data?.fingerprint ?? data?.keystore_fingerprint ?? null,
        });
      } catch (e: any) {
        setVariantLoading(variant, false);
        const msg = await formatEdgeError(e);
        Alert.alert("Status fehlgeschlagen", msg);
      }
    },
    [repoFullName, branch, adminKey, serviceRoleKey]
  );

  const runGenerate = useCallback(
    async (variant: BuildVariant) => {
      if (!repoFullName) {
        Alert.alert("Repo fehlt", "Bitte zuerst ein GitHub Repo im Projekt verbinden.");
        return;
      }
      setBusy(true);
      setVariantLoading(variant, true);
      try {
        const data: any = await invokeEdgeJson(
          "android-keystore-generate",
          { repo: repoFullName, branch, profile: variant, mode: variant },
          adminKey,
          serviceRoleKey
        );
        setVariantData(variant, {
          loading: false,
          exists: true,
          updatedAt: data?.updated_at ?? data?.updatedAt ?? null,
          storagePath: data?.storage_path ?? data?.storagePath ?? null,
          alias: data?.key_alias ?? data?.alias ?? null,
          fingerprint: data?.fingerprint ?? data?.keystore_fingerprint ?? null,
        });
        Alert.alert("✅ Key generiert", `${variant} Key wurde erstellt und gespeichert.`);
      } catch (e: any) {
        setVariantLoading(variant, false);
        const msg = await formatEdgeError(e);
        Alert.alert("Generate fehlgeschlagen", msg);
      } finally {
        setBusy(false);
      }
    },
    [repoFullName, branch, adminKey, serviceRoleKey]
  );

  const runExport = useCallback(
    async (variant: BuildVariant) => {
      if (!repoFullName) {
        Alert.alert("Repo fehlt", "Bitte zuerst ein GitHub Repo im Projekt verbinden.");
        return;
      }
      setBusy(true);
      try {
        const data: any = await invokeEdgeJson(
          "android-keystore-export",
          { repo: repoFullName, branch, profile: variant, mode: variant },
          adminKey,
          serviceRoleKey
        );
        // We don't write files on device here — CI will call this endpoint and create credentials.json.
        setLastDebug(compactJson(data, 2500));
        Alert.alert("✅ Export OK", "CI kann jetzt den Keystore ziehen (siehe Debug).");
      } catch (e: any) {
        const msg = await formatEdgeError(e);
        Alert.alert("Export fehlgeschlagen", msg);
      } finally {
        setBusy(false);
      }
    },
    [repoFullName, branch, adminKey, serviceRoleKey]
  );

  const refreshAll = useCallback(async () => {
    setBusy(true);
    try {
      for (const v of VARIANTS) {
        // eslint-disable-next-line no-await-in-loop
        await runStatus(v.id);
      }
    } finally {
      setBusy(false);
    }
  }, [runStatus]);

  useEffect(() => {
    if (repoFullName) refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoFullName]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>🔑 Credentials Wizard</Text>

      <Text style={styles.p}>
        Ziel: alle 3 Profile signiert (Dev / Preview / Production) — ohne Terminal.
      </Text>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Aktives Projekt</Text>
        <Text style={styles.boxLine}>Repo: {repoFullName ?? "—"}</Text>
        <Text style={styles.boxLine}>Branch: {branch ?? "—"}</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Voraussetzungen (in-app)</Text>
        <Text style={styles.boxLine}>
          Admin-Key: {adminKey ? "✅ gesetzt" : "❌ fehlt"}
        </Text>
        <Text style={styles.boxLine}>
          Supabase Service Role Key: {serviceRoleKey ? "✅ gesetzt" : "❌ fehlt"}
        </Text>
        {!canRun ? (
          <Text style={styles.warn}>
            Ohne beide Keys können die Edge-Funktionen nicht schreiben (DB/Storage). Setze sie
            im Connection/Settings Screen.
          </Text>
        ) : null}

        <View style={styles.actionsRow}>
          <ActionButton
            title="Refresh"
            icon="refresh-outline"
            onPress={refreshAll}
            variant="secondary"
          />
        </View>
      </View>

      {VARIANTS.map((v) => (
        <VariantCard
          key={v.id}
          meta={v}
          status={statusMap[v.id]}
          onStatus={() => runStatus(v.id)}
          onGenerate={() => runGenerate(v.id)}
          onExport={() => runExport(v.id)}
        />
      ))}

      {!!lastDebug ? (
        <View style={styles.debugBox}>
          <Text style={styles.boxTitle}>Debug</Text>
          <Text style={styles.debugText}>{lastDebug}</Text>
        </View>
      ) : null}

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator />
          <Text style={styles.busyText}>arbeite…</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 36 },
  h1: { fontSize: 22, fontWeight: "700", color: theme.colors.text, marginBottom: 8 },
  p: { color: theme.colors.text, marginBottom: 12 },
  warn: { color: theme.colors.warning, marginTop: 8 },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  box: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  boxTitle: { fontWeight: "700", color: theme.colors.text, marginBottom: 6 },
  boxLine: { color: theme.colors.textMuted, marginBottom: 2 },

  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: "700", color: theme.colors.text, marginLeft: 8 },
  note: { color: theme.colors.textMuted, marginTop: 6, marginBottom: 8 },

  badgeText: { marginLeft: 6, fontSize: 12, fontWeight: "600" },

  metaBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  metaLine: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 2 },

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnSecondary: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  btnText: { fontWeight: "700" },

  debugBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  debugText: { fontFamily: "monospace", fontSize: 12, color: theme.colors.textMuted },

  busyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  busyText: { color: theme.colors.textMuted },
});
