// screens/ConnectionsScreen.tsx
// ✅ Connections = Übersicht + Tokens/Supabase speichern + Schnelltests
// ✅ Repo/Branch Auswahl & Secrets-Sync passieren im GitHubReposScreen (nicht doppelt)
// ✅ Token-Fields haben "Auge" zum Anzeigen

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { theme } from "../theme";
import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";
import {
  getGitHubToken,
  saveGitHubToken,
  deleteGitHubToken,
  getExpoToken,
  saveExpoToken,
  deleteExpoToken,
  getEdgeAdminKey,
  saveEdgeAdminKey,
  deleteEdgeAdminKey,
} from "../contexts/githubService";

const STORAGE_KEYS = {
  SUPABASE_RAW: "supabase_raw",
  SUPABASE_URL: "supabase_url",
  SUPABASE_KEY: "supabase_key",
  SUPABASE_SERVICE_ROLE_KEY: "supabase_service_role_key",
  EAS_PROJECT_ID: "eas_project_id",
} as const;

const deriveSupabaseUrl = (raw: string): { projectId: string; url: string } => {
  const trimmed = (raw || "").trim();

  const matchUrl = trimmed.match(/^https?:\/\/([^.]+)\.supabase\.co/i);
  if (matchUrl && matchUrl[1]) {
    const id = matchUrl[1];
    return { projectId: id, url: `https://${id}.supabase.co` };
  }

  const matchId = trimmed.match(/^[a-z0-9]{6,}$/i);
  if (matchId) {
    const id = trimmed;
    return { projectId: id, url: `https://${id}.supabase.co` };
  }

  return { projectId: "", url: "" };
};

function Dot({ ok }: { ok: boolean }) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: ok ? theme.palette.success : theme.palette.error },
      ]}
    />
  );
}

function StatusRow(props: { label: string; ok: boolean; value?: string }) {
  const { label, ok, value } = props;
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusLeft}>
        <Dot ok={ok} />
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

function InputRow(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  showToggle?: boolean;
  onToggleShow?: () => void;
  isShown?: boolean;
  rightHint?: string;
  multiline?: boolean;
}) {
  const {
    label,
    value,
    onChangeText,
    placeholder,
    secure,
    showToggle,
    onToggleShow,
    isShown,
    rightHint,
    multiline,
  } = props;

  const secureTextEntry = secure && !isShown;

  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.inputHeader}>
        <Text style={styles.label}>{label}</Text>
        {rightHint ? <Text style={styles.hintInline}>{rightHint}</Text> : null}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.palette.input.placeholder}
          style={[
            styles.input,
            multiline && { minHeight: 88, textAlignVertical: "top" },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          multiline={!!multiline}
        />
        {showToggle ? (
          <TouchableOpacity
            onPress={onToggleShow}
            style={styles.eyeBtn}
            accessibilityLabel="Toggle token visibility"
          >
            <Ionicons
              name={isShown ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function ConnectionsScreen() {
  const navigation = useNavigation<any>();
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData } = useProject();

  const [busy, setBusy] = useState(false);

  // Tokens
  const [githubToken, setGithubToken] = useState("");
  const [expoToken, setExpoToken] = useState("");
  const [edgeAdminKey, setEdgeAdminKeyState] = useState("");

  const [showGitHub, setShowGitHub] = useState(false);
  const [showExpo, setShowExpo] = useState(false);
  const [showEdge, setShowEdge] = useState(false);

  // Supabase
  const [supabaseRaw, setSupabaseRaw] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState("");

  // EAS
  const [easProjectId, setEasProjectId] = useState("");

  const repoLine = useMemo(() => {
    const repo = activeRepo || projectData?.linkedRepo || "";
    const br = activeBranch || projectData?.linkedBranch || "";
    if (!repo) return "";
    return `${repo}${br ? ` (${br})` : ""}`;
  }, [
    activeRepo,
    activeBranch,
    projectData?.linkedRepo,
    projectData?.linkedBranch,
  ]);

  // Load stored settings on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [gh, ex, edge] = await Promise.all([
        getGitHubToken().catch(() => ""),
        getExpoToken().catch(() => ""),
        getEdgeAdminKey().catch(() => ""),
      ]);
      const [raw, url, anon, srv, eas] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY).catch(
          () => "",
        ),
        AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => ""),
      ]);

      if (!mounted) return;
      setGithubToken(gh || "");
      setExpoToken(ex || "");
      setEdgeAdminKeyState(edge || "");
      setSupabaseRaw(raw || "");
      setSupabaseUrl(url || "");
      setSupabaseAnonKey(anon || "");
      setSupabaseServiceRoleKey(srv || "");
      setEasProjectId(eas || "");
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Supabase URL derived from raw input
  useEffect(() => {
    const d = deriveSupabaseUrl(supabaseRaw);
    if (d.url) setSupabaseUrl(d.url);
  }, [supabaseRaw]);

  const saveAll = useCallback(async () => {
    setBusy(true);
    try {
      const gh = githubToken.trim();
      const ex = expoToken.trim();
      const edge = edgeAdminKey.trim();

      if (gh) await saveGitHubToken(gh);
      else await deleteGitHubToken();

      if (ex) await saveExpoToken(ex);
      else await deleteExpoToken();

      if (edge) await saveEdgeAdminKey(edge);
      else await deleteEdgeAdminKey();

      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, supabaseRaw.trim());
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, supabaseUrl.trim());
      await AsyncStorage.setItem(
        STORAGE_KEYS.SUPABASE_KEY,
        supabaseAnonKey.trim(),
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY,
        supabaseServiceRoleKey.trim(),
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.EAS_PROJECT_ID,
        easProjectId.trim(),
      );

      Alert.alert(
        "✅ Gespeichert",
        "Tokens & Verbindungen wurden gespeichert.",
      );
    } catch (e: any) {
      Alert.alert(
        "❌ Speichern fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
    } finally {
      setBusy(false);
    }
  }, [
    githubToken,
    expoToken,
    edgeAdminKey,
    supabaseRaw,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    easProjectId,
  ]);

  const testGitHub = useCallback(async () => {
    const gh = githubToken.trim();
    if (!gh) return Alert.alert("Fehlt", "GitHub Token fehlt.");
    setBusy(true);
    try {
      const resp = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${gh}`,
        },
      });
      if (!resp.ok) throw new Error(`GitHub Test failed (${resp.status})`);
      const j = await resp.json().catch(() => ({}));
      Alert.alert("✅ GitHub OK", `User: ${j?.login || "ok"}`);
    } catch (e: any) {
      Alert.alert("❌ GitHub Test", e?.message || "Fehler");
    } finally {
      setBusy(false);
    }
  }, [
    githubToken,
    expoToken,
    edgeAdminKey,
    supabaseRaw,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    easProjectId,
  ]);

  const testSupabase = useCallback(async () => {
    const url = supabaseUrl.trim();
    const anon = supabaseAnonKey.trim();
    if (!url) return Alert.alert("Fehlt", "Supabase URL fehlt.");
    if (!anon) return Alert.alert("Fehlt", "Supabase ANON Key fehlt.");

    setBusy(true);
    try {
      // Basic REST ping
      const resp = await fetch(`${url}/rest/v1/`, {
        method: "GET",
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });
      if (!resp.ok) throw new Error(`REST Ping failed (${resp.status})`);

      // build_jobs table check (wichtig fürs Build-System)
      const tableRes = await fetch(
        `${url}/rest/v1/build_jobs?select=id&limit=1`,
        {
          method: "GET",
          headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        },
      );
      if (!tableRes.ok) {
        throw new Error(`Tabelle build_jobs fehlt (${tableRes.status}).`);
      }

      Alert.alert("✅ Supabase OK", "REST + build_jobs erreichbar.");
    } catch (e: any) {
      Alert.alert("❌ Supabase Test", e?.message || "Fehler");
    } finally {
      setBusy(false);
    }
  }, [supabaseUrl, supabaseAnonKey]);

  // Status flags
  const status = useMemo(() => {
    const gh = !!githubToken.trim();
    const ex = !!expoToken.trim();
    const edge = !!edgeAdminKey.trim();
    const sbUrl = !!supabaseUrl.trim();
    const sbAnon = !!supabaseAnonKey.trim();
    const sbSrv = !!supabaseServiceRoleKey.trim();
    const linked = !!(projectData?.linkedRepo || activeRepo);
    const eas = !!easProjectId.trim();
    return { gh, ex, edge, sbUrl, sbAnon, sbSrv, linked, eas };
  }, [
    githubToken,
    expoToken,
    edgeAdminKey,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    projectData?.linkedRepo,
    activeRepo,
    easProjectId,
  ]);

  const Btn = (props: {
    label: string;
    icon: any;
    onPress: () => void;
    variant?: "primary" | "ghost";
    loading?: boolean;
  }) => {
    const { label, icon, onPress, variant = "primary", loading } = props;
    const isPrimary = variant === "primary";
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={busy || !!loading}
        style={[
          styles.btn,
          isPrimary ? styles.btnPrimary : styles.btnGhost,
          (busy || loading) && { opacity: 0.65 },
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={isPrimary ? "#000" : theme.palette.text.primary}
          />
        ) : (
          <Ionicons
            name={icon}
            size={18}
            color={isPrimary ? "#000" : theme.palette.text.primary}
          />
        )}
        <Text style={[styles.btnText, isPrimary ? { color: "#000" } : null]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>Verbindungen</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="pulse-outline"
              size={18}
              color={theme.palette.primary}
            />
            <Text style={styles.cardTitle}>Status</Text>
          </View>

          <StatusRow
            label="Repo/Branch verknüpft"
            ok={status.linked}
            value={repoLine || undefined}
          />
          <StatusRow label="GitHub Token (PAT)" ok={status.gh} />
          <StatusRow label="Expo / EAS Token (EXPO_TOKEN)" ok={status.ex} />
          <StatusRow
            label="Supabase URL"
            ok={status.sbUrl}
            value={status.sbUrl ? supabaseUrl : undefined}
          />
          <StatusRow label="Supabase ANON Key" ok={status.sbAnon} />
          <StatusRow label="Supabase Service Role" ok={status.sbSrv} />
          <StatusRow label="Edge Admin Key (optional)" ok={status.edge} />
          <StatusRow
            label="EAS Project ID (optional)"
            ok={status.eas}
            value={status.eas ? easProjectId : undefined}
          />

          <View style={styles.row}>
            <Btn
              label="Zu Repos/Branches"
              icon="logo-github"
              onPress={() => navigation.navigate("GitHubRepos")}
            />
            <Btn
              label="Diagnose"
              icon="flask-outline"
              variant="ghost"
              onPress={() => navigation.navigate("Diagnostic")}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="key-outline"
              size={18}
              color={theme.palette.primary}
            />
            <Text style={styles.cardTitle}>Tokens</Text>
          </View>

          <InputRow
            label="GitHub Token (PAT)"
            value={githubToken}
            onChangeText={setGithubToken}
            placeholder="ghp_..."
            secure
            showToggle
            isShown={showGitHub}
            onToggleShow={() => setShowGitHub((p) => !p)}
            rightHint="Scopes: repo + workflow"
          />

          <InputRow
            label="Expo / EAS Token (EXPO_TOKEN)"
            value={expoToken}
            onChangeText={setExpoToken}
            placeholder="expo_..."
            secure
            showToggle
            isShown={showExpo}
            onToggleShow={() => setShowExpo((p) => !p)}
          />

          <InputRow
            label="Edge Admin Key (optional, x-k1w1-admin-key)"
            value={edgeAdminKey}
            onChangeText={setEdgeAdminKeyState}
            placeholder="selbst-gewähltes-secret"
            secure
            showToggle
            isShown={showEdge}
            onToggleShow={() => setShowEdge((p) => !p)}
          />

          <View style={styles.row}>
            <Btn label="Speichern" icon="save-outline" onPress={saveAll} />
            <Btn
              label="GitHub testen"
              icon="checkmark-done-outline"
              variant="ghost"
              onPress={testGitHub}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="server-outline"
              size={18}
              color={theme.palette.primary}
            />
            <Text style={styles.cardTitle}>Supabase</Text>
          </View>

          <InputRow
            label="Supabase Project ID oder URL"
            value={supabaseRaw}
            onChangeText={setSupabaseRaw}
            placeholder="xfgnzpcljsuqqdjlxgul  oder  https://xxxxx.supabase.co"
          />

          <InputRow
            label="Supabase URL (auto)"
            value={supabaseUrl}
            onChangeText={setSupabaseUrl}
            placeholder="https://xxxxx.supabase.co"
          />

          <InputRow
            label="Supabase ANON Key"
            value={supabaseAnonKey}
            onChangeText={setSupabaseAnonKey}
            placeholder="eyJhbGciOi..."
            secure
            showToggle={false}
          />

          <InputRow
            label="Supabase Service Role Key (für Edge/Build-Jobs)"
            value={supabaseServiceRoleKey}
            onChangeText={setSupabaseServiceRoleKey}
            placeholder="eyJhbGciOi... (service role)"
            secure
            showToggle={false}
          />

          <View style={styles.row}>
            <Btn label="Speichern" icon="save-outline" onPress={saveAll} />
            <Btn
              label="Supabase testen"
              icon="pulse-outline"
              variant="ghost"
              onPress={testSupabase}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="rocket-outline"
              size={18}
              color={theme.palette.primary}
            />
            <Text style={styles.cardTitle}>EAS</Text>
          </View>

          <InputRow
            label="EAS Project ID (optional)"
            value={easProjectId}
            onChangeText={setEasProjectId}
            placeholder="5e5a7791-8751-416b-9a1f-831adfffcb6c"
            rightHint="Wird beim EAS-Link genutzt"
          />

          <Text style={styles.hint}>
            EAS-Link/Init ist im Repo-Screen (dort wird auch geprüft/auto-fix:
            Workflow-Dateien im Ziel-Repo).
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: 16, paddingBottom: 40 },

  h1: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginBottom: 12,
  },

  card: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
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

  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  btn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: theme.palette.primary,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
  },

  dot: { width: 10, height: 10, borderRadius: 999, marginRight: 8 },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  statusLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  statusLabel: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  statusValue: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    maxWidth: "55%",
  },
  statusValueMuted: { color: theme.palette.text.muted, fontSize: 12 },

  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
  hintInline: { color: theme.palette.text.muted, fontSize: 11 },

  inputRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.input.border,
    backgroundColor: theme.palette.input.background,
  },
  input: {
    flex: 1,
    color: theme.palette.text.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  eyeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  hint: {
    marginTop: 10,
    color: theme.palette.text.muted,
    fontSize: 12,
    lineHeight: 16,
  },
});
