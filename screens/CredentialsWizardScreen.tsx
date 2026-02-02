import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../theme";
import { ensureSupabaseClient } from "../lib/supabase";
import { useProject } from "../contexts/ProjectContext";
import { getEdgeAdminKey } from "../contexts/githubService";

function formatEdgeInvokeError(err: any): string {
  try {
    if (!err) return "Unknown error";

    const out: any = {
      name: err?.name,
      message: err?.message,
      status: err?.status,
      stack: typeof err?.stack === "string" ? err.stack.split("\n").slice(0, 8).join("\n") : undefined,
    };

    // supabase-js FunctionsHttpError sometimes provides a Response-like context
    const ctx: any = err?.context;
    if (ctx) {
      out.context = {
        status: ctx?.status,
        statusText: ctx?.statusText,
        headers: ctx?.headers,
        body: ctx?.body,
      };
      // If context is a Response, it won't be serializable; include minimal info.
      if (typeof ctx === "object" && typeof ctx?.url === "string") out.context.url = ctx.url;
    }

    if (err?.details) out.details = err.details;
    if (err?.hint) out.hint = err.hint;

    return JSON.stringify(out, null, 2);
  } catch {
    try {
      return String(err);
    } catch {
      return "Unknown error";
    }
  }
}


const RUNTIME_SUPABASE_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ?? "";
const RUNTIME_SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ?? "";

async function invokeEdgeJson<T>(
  fnName: string,
  payload: any,
  adminKey?: string
): Promise<T> {
  const hasRuntime = Boolean(RUNTIME_SUPABASE_URL && RUNTIME_SUPABASE_ANON_KEY);

  // Fallback: use supabase-js invoke if runtime env is not available (older builds / tests)
  if (!hasRuntime) {
    const sb = await ensureSupabaseClient();
    const { data, error } = await sb.functions.invoke(fnName, {
      body: payload,
      headers: adminKey ? { "x-k1w1-admin-key": adminKey } : undefined,
    } as any);

    if (error) throw error;
    return data as T;
  }

  const url =
    RUNTIME_SUPABASE_URL.replace(/\/$/, "") + `/functions/v1/${fnName}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: RUNTIME_SUPABASE_ANON_KEY,
    // Edge Functions accept anon key as bearer in many setups; if you require JWT, this will return 401 and we will show details.
    Authorization: `Bearer ${RUNTIME_SUPABASE_ANON_KEY}`,
  };
  if (adminKey) headers["x-k1w1-admin-key"] = adminKey;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload ?? {}),
  });

  const text = await res.text();

  if (!res.ok) {
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    const err: any = new Error(
      parsed?.error ||
        parsed?.message ||
        `Edge Function "${fnName}" failed with HTTP ${res.status}`
    );
    err.status = res.status;
    err.details = parsed ?? text;
    err.context = {
      url,
      status: res.status,
      statusText: res.statusText,
      body: text,
    };
    throw err;
  }

  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Some functions may return plain text.
    return text as any as T;
  }
}

function parseLinkedRepo(linkedRepo?: string | null): { owner: string; name: string; branch: string } | null {
  if (!linkedRepo) return null;

  // Supported formats:
  // - "owner/name"
  // - "owner/name#branch"
  // - "owner/name@branch"
  const cleaned = linkedRepo.trim();
  const hashSplit = cleaned.includes("#") ? cleaned.split("#") : cleaned.includes("@") ? cleaned.split("@") : [cleaned];
  const repoPart = hashSplit[0];
  const branch = (hashSplit[1] || "main").trim() || "main";

  const [owner, name] = repoPart.split("/");
  if (!owner || !name) return null;

  return { owner, name, branch };
}


type BuildVariant = "development" | "preview" | "production";

function VariantCard({
  label,
  desc,
  active,
  onPress,
}: {
  label: string;
  desc: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.variantCard,
        { borderColor: active ? theme.palette.primary : theme.palette.border },
      ]}
      activeOpacity={0.9}
    >
      <View style={styles.variantHeader}>
        <Text style={styles.variantTitle}>{label}</Text>
        {active ? (
          <Ionicons name="checkmark-circle" size={18} color={theme.palette.primary} />
        ) : (
          <Ionicons name="ellipse-outline" size={18} color={theme.palette.text.muted} />
        )}
      </View>
      <Text style={styles.variantDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

/**
 * Credentials Wizard (Android)
 * Ziel: Keystore vollständig "in-app" erzeugen und in Supabase ablegen,
 * sodass GitHub Actions (production) später signiert bauen kann.
 */
export default function CredentialsWizardScreen() {
  const { projectData } = useProject();
  const [variant, setVariant] = useState<BuildVariant>("production");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [lastEdgeError, setLastEdgeError] = useState<string>("");

  const title = useMemo(() => {
    if (variant === "development") return "Dev (APK) – schnell & locker";
    if (variant === "preview") return "Preview (APK) – intern teilen";
    return "Produce (APK) – Release / Store";
  }, [variant]);

  const explanation = useMemo(() => {
    if (variant === "production") {
      return "Für Produce brauchst du Signing. Wir erzeugen den Android Keystore serverseitig über Supabase und speichern ihn sicher (Repo muss exakt matchen: owner/name).";
    }
    return "Dev/Preview können optional ohne Credentials laufen (CI-safe). Du kannst trotzdem später Signing hinzufügen.";
  }, [variant]);

  const runGenerate = useCallback(async () => {
    try {
      setBusy(true);
      setStatusMsg("");

      const repo = parseLinkedRepo(projectData?.linkedRepo);
      if (!repo?.owner || !repo?.name) {
        Alert.alert(
          "Repo nicht verknüpft",
          "Bitte zuerst ein GitHub Repo/Branch mit diesem Projekt verbinden."
        );
        return;
      }

      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

      setStatusMsg("🔐 Keystore wird erzeugt…");
      const data: any = await invokeEdgeJson<any>(
        "android-keystore-generate",
        {
          repo: `${repo.owner}/${repo.name}`,
          branch: repo.branch || "main",
          mode: variant,
        },
        edgeAdminKey || undefined
      );

      setStatusMsg("✅ Keystore erzeugt und gespeichert.");

      Alert.alert(
        "Fertig ✅",
        `Keystore ist jetzt in Supabase gespeichert.\n\nRepo: ${repo.owner}/${repo.name}\nAlias: ${data?.alias || "unknown"}`
      );
    } catch (e: any) {
      setLastEdgeError(formatEdgeInvokeError(e));
      Alert.alert(
        "Keystore Fehler",
        e?.message || "Keystore konnte nicht erstellt werden."
      );
      setStatusMsg(`❌ ${e?.message || "Fehler"}`);
    } finally {
      setBusy(false);
    }
  }, [variant]);

  const runStatus = useCallback(async () => {
    try {
      setBusy(true);
      setStatusMsg("");

      const repo = parseLinkedRepo(projectData?.linkedRepo);
      if (!repo?.owner || !repo?.name) {
        Alert.alert(
          "Repo nicht verknüpft",
          "Bitte zuerst ein GitHub Repo/Branch mit diesem Projekt verbinden."
        );
        return;
      }

      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
      setStatusMsg("🔎 Prüfe Keystore Status…");

      const data: any = await invokeEdgeJson<any>(
        "android-keystore-status",
        { repo: `${repo.owner}/${repo.name}` },
        edgeAdminKey || undefined
      );

      if (!data?.exists) {
        setStatusMsg("⚠️ Kein Keystore gefunden.");
        Alert.alert("Status", "Keystore fehlt – bitte erzeugen.");
        return;
      }

      setStatusMsg("✅ Keystore vorhanden.");
      const alias = data?.record?.alias ?? data?.alias ?? "unknown";
      const updatedAt = data?.record?.updatedAt ?? data?.updatedAt ?? data?.createdAt ?? "";
      Alert.alert(
        "Status ✅",
        `Keystore vorhanden\nAlias: ${alias}${updatedAt ? `\nUpdated: ${updatedAt}` : ""}`
      );
    } catch (e: any) {
      setLastEdgeError(formatEdgeInvokeError(e));
      setStatusMsg(`❌ ${e?.message || "Fehler"}`);
      Alert.alert("Status Fehler", e?.message || "Status konnte nicht geprüft werden.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.h1}>Credentials Wizard</Text>
        <Text style={styles.subtitle}>Android Signing in-App (Supabase + CI)</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Build-Variante</Text>

        <VariantCard
          label="Dev"
          desc="Schnell testen (optional unsigned)"
          active={variant === "development"}
          onPress={() => setVariant("development")}
        />
        <VariantCard
          label="Preview"
          desc="Interne APK teilen (optional unsigned)"
          active={variant === "preview"}
          onPress={() => setVariant("preview")}
        />
        <VariantCard
          label="Produce"
          desc="Release/Store (Signing required)"
          active={variant === "production"}
          onPress={() => setVariant("production")}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{title}</Text>
        <Text style={styles.blockText}>{explanation}</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={runStatus}
            disabled={busy}
          >
            <Ionicons name="search" size={16} color={theme.palette.text.primary} />
            <Text style={styles.btnText}>Status</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={runGenerate}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={theme.palette.text.primary} />
            ) : (
              <Ionicons name="key" size={16} color={theme.palette.text.primary} />
            )}
            <Text style={styles.btnText}>Generate</Text>
          </TouchableOpacity>
        </View>

        {!!statusMsg && <Text style={styles.status}>{statusMsg}</Text>}

        {!!lastEdgeError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Edge Fehler Details (Debug)</Text>
            <Text selectable style={styles.errorText}>
              {lastEdgeError}
            </Text>
          </View>
        )}

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>Wichtig</Text>
          <Text style={styles.noteText}>
            • Dev/Preview laufen in CI auch ohne Keystore (wenn Workflow/Diagnostics es so setzt).{"\n"}
            • Produce braucht Signing. Der Keystore wird sicher in Supabase gespeichert und im CI nur kurzzeitig als File benutzt.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  h1: { fontSize: 24, fontWeight: "800", color: theme.palette.text.primary },
  subtitle: { marginTop: 6, color: theme.palette.text.muted },

  block: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  blockTitle: { fontSize: 16, fontWeight: "800", color: theme.palette.text.primary },
  blockText: { marginTop: 8, color: theme.palette.text.secondary, lineHeight: 20 },

  variantCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    backgroundColor: theme.palette.cardHover,
  },
  variantHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  variantTitle: { fontSize: 14, fontWeight: "800", color: theme.palette.text.primary },
  variantDesc: { marginTop: 6, color: theme.palette.text.muted },

  actionsRow: { marginTop: 12, flexDirection: "row", gap: 10 },

  errorBox: {
    marginTop: 12,
    backgroundColor: theme.palette.cardHover,
    borderColor: theme.palette.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorTitle: { fontSize: 13, fontWeight: "800", color: theme.palette.text.primary },
  errorText: { marginTop: 8, color: theme.palette.text.muted, fontFamily: "monospace" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flex: 1,
  },
  btnPrimary: { backgroundColor: theme.palette.primary },
  btnSecondary: { backgroundColor: theme.palette.cardHover, borderWidth: 1, borderColor: theme.palette.border },
  btnText: { fontWeight: "800", color: theme.palette.text.primary },

  status: { marginTop: 12, color: theme.palette.text.muted, fontWeight: "700" },

  noteBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.palette.cardHover,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  noteTitle: { fontWeight: "900", color: theme.palette.text.primary, marginBottom: 6 },
  noteText: { color: theme.palette.text.secondary, lineHeight: 20 },
});
