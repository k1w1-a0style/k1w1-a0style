// screens/ConnectionsScreen.tsx
// ✅ FIX: Verbindungsscreen wieder komplett (GitHub + Expo + Supabase + EAS)
// ✅ FIX: init/link EAS via GitHub Actions workflow (eas-link.yml) -> kein 404 mehr
// ✅ FIX: Secrets Sync berücksichtigt jetzt auch optional EAS_PROJECT_ID + K1W1_EDGE_ADMIN_KEY (wenn gesetzt)

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { autoSyncRepoSecrets } from "../lib/autoSyncRepoSecrets";

const STORAGE_KEYS = {
  SUPABASE_RAW: "supabase_raw",
  SUPABASE_URL: "supabase_url",
  SUPABASE_KEY: "supabase_key",
  SUPABASE_SERVICE_ROLE_KEY: "supabase_service_role_key",
  EAS_PROJECT_ID: "eas_project_id",
} as const;

const WORKFLOWS = {
  EAS_LINK: "eas-link.yml",
} as const;

const isValidFullName = (s: string) =>
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s);

const deriveSupabaseUrl = (raw: string): { projectId: string; url: string } => {
  const trimmed = (raw || "").trim();

  const matchUrl = trimmed.match(/^https?:\/\/([^.]+)\.supabase\.co/i);
  if (matchUrl && matchUrl[1]) {
    const id = matchUrl[1];
    return { projectId: id, url: `https://${id}.supabase.co` };
  }

  // Sonst als Project-ID verwenden (z.B. "xfgnzpcljsuqqdjlxgul")
  return { projectId: trimmed, url: `https://${trimmed}.supabase.co` };
};

export default function ConnectionsScreen() {
  const navigation = useNavigation<any>();
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData, setLinkedRepo } = useProject();

  const linkedRepo = projectData?.linkedRepo ?? null;
  const linkedBranch = projectData?.linkedBranch ?? null;

  const effectiveRepo = activeRepo ?? linkedRepo ?? null;
  const effectiveBranch = (activeBranch ?? linkedBranch ?? "main").trim();

  const repoLine = useMemo(() => {
    if (!effectiveRepo) return "Kein Repo ausgewählt";
    return `${effectiveRepo}${effectiveBranch ? `  (${effectiveBranch})` : ""}`;
  }, [effectiveRepo, effectiveBranch]);

  // Tokens (SecureStore)
  const [githubToken, setGithubToken] = useState("");
  const [expoToken, setExpoToken] = useState("");
  const [edgeAdminKey, setEdgeAdminKeyState] = useState("");

  // Supabase config
  const [supabaseRaw, setSupabaseRaw] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState("");

  // EAS project id (optional)
  const [easProjectId, setEasProjectId] = useState("");

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState<{
    ghTest?: boolean;
    sbTest?: boolean;
    sync?: boolean;
    eas?: boolean;
  }>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [gh, ex, edge, raw, url, anon, serviceRole, easId] =
          await Promise.all([
            getGitHubToken(),
            getExpoToken(),
            getEdgeAdminKey(),
            AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW),
            AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL),
            AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY),
            AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY),
            AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID),
          ]);

        if (gh) setGithubToken(gh);
        if (ex) setExpoToken(ex);
        if (edge) setEdgeAdminKeyState(edge);

        if (raw) setSupabaseRaw(raw);
        if (url) setSupabaseUrl(url);
        if (anon) setSupabaseAnonKey(anon);
        if (serviceRole) setSupabaseServiceRoleKey(serviceRole);

        if (easId) setEasProjectId(easId);
      } catch (e) {
        console.error("[Connections] load failed", e);
      }
    };
    load();
  }, []);

  const saveTokens = useCallback(async () => {
    const gh = githubToken.trim();
    const ex = expoToken.trim();
    const edge = edgeAdminKey.trim();

    setBusy(true);
    try {
      if (gh) await saveGitHubToken(gh);
      else await deleteGitHubToken();

      if (ex) await saveExpoToken(ex);
      else await deleteExpoToken();

      if (edge) await saveEdgeAdminKey(edge);
      else await deleteEdgeAdminKey();

      Alert.alert("✅ Gespeichert", "Tokens gespeichert.");
    } catch (e: any) {
      Alert.alert("Fehler", e?.message || "Konnte Tokens nicht speichern.");
    } finally {
      setBusy(false);
    }
  }, [githubToken, expoToken, edgeAdminKey]);

  const saveSupabase = useCallback(async () => {
    const raw = supabaseRaw.trim();
    const anonKey = supabaseAnonKey.trim();
    const service = supabaseServiceRoleKey.trim();

    let finalUrl = supabaseUrl.trim();
    if (!finalUrl && raw) finalUrl = deriveSupabaseUrl(raw).url;

    if (!finalUrl)
      return Alert.alert("Fehlt", "Supabase URL/Project-ID fehlt.");
    if (!anonKey) return Alert.alert("Fehlt", "Supabase ANON Key fehlt.");

    setBusy(true);
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.SUPABASE_RAW, raw],
        [STORAGE_KEYS.SUPABASE_URL, finalUrl],
        [STORAGE_KEYS.SUPABASE_KEY, anonKey],
        [STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY, service],
      ]);
      setSupabaseUrl(finalUrl);
      Alert.alert("✅ Gespeichert", "Supabase Settings gespeichert.");
    } catch {
      Alert.alert("Fehler", "Konnte Supabase Settings nicht speichern.");
    } finally {
      setBusy(false);
    }
  }, [supabaseRaw, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey]);

  const saveEasProjectId = useCallback(async () => {
    const v = easProjectId.trim();
    setBusy(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, v);
      Alert.alert("✅ Gespeichert", "EAS Project ID gespeichert.");
    } catch {
      Alert.alert("Fehler", "Konnte EAS Project ID nicht speichern.");
    } finally {
      setBusy(false);
    }
  }, [easProjectId]);

  const testGitHub = useCallback(async () => {
    const token = githubToken.trim();
    if (!token) return Alert.alert("Fehlt", "GitHub Token fehlt.");

    setLoading((p) => ({ ...p, ghTest: true }));
    try {
      const resp = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.message || `GitHub Fehler (${resp.status})`);
      }
      const me = await resp.json();
      Alert.alert("✅ GitHub OK", `Eingeloggt als: ${me?.login || "?"}`);
    } catch (e: any) {
      Alert.alert("❌ GitHub Test", e?.message || "Fehler");
    } finally {
      setLoading((p) => ({ ...p, ghTest: false }));
    }
  }, [githubToken]);

  const testSupabase = useCallback(async () => {
    const url = (supabaseUrl || "").trim();
    const anonKey = (supabaseAnonKey || "").trim();
    if (!url || !anonKey) {
      return Alert.alert("Fehlt", "Supabase URL + ANON Key fehlen.");
    }

    setLoading((p) => ({ ...p, sbTest: true }));
    try {
      // REST Root Ping
      const resp = await fetch(`${url}/rest/v1/`, {
        method: "GET",
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      if (!resp.ok) throw new Error(`REST Ping failed (${resp.status})`);

      // build_jobs exist check (wichtig für Build-System)
      const tableRes = await fetch(
        `${url}/rest/v1/build_jobs?select=id&limit=1`,
        {
          method: "GET",
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        },
      );
      if (!tableRes.ok) {
        throw new Error(`Tabelle build_jobs fehlt (${tableRes.status}).`);
      }

      Alert.alert("✅ Supabase OK", "REST + build_jobs erreichbar.");
    } catch (e: any) {
      Alert.alert("❌ Supabase Test", e?.message || "Fehler");
    } finally {
      setLoading((p) => ({ ...p, sbTest: false }));
    }
  }, [supabaseUrl, supabaseAnonKey]);

  const syncSecrets = useCallback(async () => {
    if (!effectiveRepo)
      return Alert.alert("Kein Repo", "Bitte Repo auswählen.");

    setLoading((p) => ({ ...p, sync: true }));
    try {
      const res = await autoSyncRepoSecrets(effectiveRepo);
      Alert.alert(
        "✅ Secrets synced",
        `Updated: ${res.updated.length}\nSkipped: ${res.skipped.length}`,
      );
    } catch (e: any) {
      Alert.alert("❌ Sync fehlgeschlagen", e?.message || "Fehler");
    } finally {
      setLoading((p) => ({ ...p, sync: false }));
    }
  }, [effectiveRepo]);

  const initEasProject = useCallback(async () => {
    const gh = githubToken.trim();
    if (!gh) return Alert.alert("Fehlt", "GitHub Token fehlt.");
    if (!effectiveRepo)
      return Alert.alert("Fehlt", "Repo auswählen (GitHub Repos).");
    if (!isValidFullName(effectiveRepo)) {
      return Alert.alert(
        "Repo-Format falsch",
        "Repo muss so aussehen: OWNER/REPO (z.B. kiwi-pro-plus/mein-repo)",
      );
    }

    const [owner, repo] = effectiveRepo.split("/");
    const ref = effectiveBranch || "main";
    const easId = easProjectId.trim(); // optional

    setLoading((p) => ({ ...p, eas: true }));
    try {
      // Erst prüfen ob der Workflow im Repo existiert (sonst 404)
      const wfCheck = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/${encodeURIComponent(
          WORKFLOWS.EAS_LINK,
        )}?ref=${encodeURIComponent(ref)}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${gh}`,
          },
        },
      );

      if (wfCheck.status === 404) {
        throw new Error(
          `Workflow '${WORKFLOWS.EAS_LINK}' fehlt im Repo (Branch '${ref}').\n\nFix: Sync das Projekt einmal (damit der Workflow gepusht wird).`,
        );
      }

      const dispatchRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(
          WORKFLOWS.EAS_LINK,
        )}/dispatches`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${gh}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ref,
            inputs: { eas_project_id: easId },
          }),
        },
      );

      if (!dispatchRes.ok) {
        const j = await dispatchRes.json().catch(() => ({}));
        throw new Error(
          `GitHub workflow dispatch failed (${dispatchRes.status}): ${
            j?.message || "unknown"
          }`,
        );
      }

      Alert.alert(
        "✅ Workflow gestartet",
        `EAS-Link läuft jetzt in GitHub Actions.\nRepo: ${effectiveRepo}\nBranch: ${ref}`,
      );
    } catch (e: any) {
      Alert.alert("❌ initEasProject", e?.message || "Fehler");
    } finally {
      setLoading((p) => ({ ...p, eas: false }));
    }
  }, [githubToken, effectiveRepo, effectiveBranch, easProjectId]);

  const Section = ({
    title,
    icon,
    children,
  }: {
    title: string;
    icon: any;
    children: React.ReactNode;
  }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Ionicons name={icon} size={18} color={theme.palette.primary} />
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );

  const Btn = ({
    label,
    onPress,
    loading: isBtnLoading,
  }: {
    label: string;
    onPress: () => void;
    loading?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy || !!isBtnLoading}
      style={[
        s.btn,
        s.btnPrimary,
        busy || isBtnLoading ? { opacity: 0.6 } : null,
      ]}
    >
      {isBtnLoading ? (
        <ActivityIndicator size="small" color={theme.palette.text.primary} />
      ) : null}
      <Text style={s.btnText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.h1}>Connections</Text>

        <Section title="Projekt / Repo" icon="git-branch-outline">
          <Text style={s.muted}>Aktiv:</Text>
          <Text style={s.repoLine} numberOfLines={2}>
            {repoLine}
          </Text>

          <View style={s.row}>
            <Btn
              label="Repo/Branch auswählen"
              onPress={() => navigation.navigate("GitHubRepos")}
            />
            <Btn
              label="Projekt verknüpfen"
              onPress={async () => {
                if (!effectiveRepo)
                  return Alert.alert("Fehlt", "Bitte Repo auswählen.");
                await setLinkedRepo(effectiveRepo, effectiveBranch || "main");
                Alert.alert(
                  "✅ Verknüpft",
                  `Projekt ↔ ${effectiveRepo} (${effectiveBranch || "main"})`,
                );
              }}
            />
          </View>

          <View style={s.row}>
            <Btn
              label="Secrets syncen"
              onPress={syncSecrets}
              loading={!!loading.sync}
            />
            <Btn
              label="init / link EAS"
              onPress={initEasProject}
              loading={!!loading.eas}
            />
          </View>

          <Text style={s.hint}>
            404 bei init/link = meistens: Workflow fehlt im Repo, falsches
            Repo-Format, oder Token hat keine Actions-Rechte.
          </Text>
        </Section>

        <Section title="GitHub + Expo Tokens" icon="key-outline">
          <Text style={s.label}>GitHub Token (PAT)</Text>
          <TextInput
            value={githubToken}
            onChangeText={setGithubToken}
            placeholder="ghp_..."
            placeholderTextColor={theme.palette.input.placeholder}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
          />

          <Text style={s.label}>Expo / EAS Token (EXPO_TOKEN)</Text>
          <TextInput
            value={expoToken}
            onChangeText={setExpoToken}
            placeholder="expo_..."
            placeholderTextColor={theme.palette.input.placeholder}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
          />

          <Text style={s.label}>Edge Admin Key (optional)</Text>
          <TextInput
            value={edgeAdminKey}
            onChangeText={setEdgeAdminKeyState}
            placeholder="selbst-gewähltes-secret (x-k1w1-admin-key)"
            placeholderTextColor={theme.palette.input.placeholder}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
          />

          <View style={s.row}>
            <Btn label="Tokens speichern" onPress={saveTokens} />
            <Btn
              label="GitHub testen"
              onPress={testGitHub}
              loading={!!loading.ghTest}
            />
          </View>

          <Text style={s.hint}>
            GitHub Token (classic): scopes repo + workflow. Fine-grained:
            Contents (RW) + Actions (RW).
          </Text>
        </Section>

        <Section title="Supabase" icon="server-outline">
          <Text style={s.label}>Supabase Project ID (optional)</Text>
          <TextInput
            value={supabaseRaw}
            onChangeText={setSupabaseRaw}
            placeholder="xfgnzpcljsuqqdjlxgul"
            placeholderTextColor={theme.palette.input.placeholder}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={s.label}>Supabase URL</Text>
          <TextInput
            value={supabaseUrl}
            onChangeText={setSupabaseUrl}
            placeholder="https://xxxxx.supabase.co"
            placeholderTextColor={theme.palette.input.placeholder}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={s.label}>Supabase ANON Key</Text>
          <TextInput
            value={supabaseAnonKey}
            onChangeText={setSupabaseAnonKey}
            placeholder="eyJhbGciOi..."
            placeholderTextColor={theme.palette.input.placeholder}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
          />

          <Text style={s.label}>Supabase Service Role Key</Text>
          <TextInput
            value={supabaseServiceRoleKey}
            onChangeText={setSupabaseServiceRoleKey}
            placeholder="eyJhbGciOi... (service_role)"
            placeholderTextColor={theme.palette.input.placeholder}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
          />

          <View style={s.row}>
            <Btn label="Supabase speichern" onPress={saveSupabase} />
            <Btn
              label="Supabase testen"
              onPress={testSupabase}
              loading={!!loading.sbTest}
            />
          </View>
        </Section>

        <Section title="EAS Project ID" icon="finger-print-outline">
          <Text style={s.label}>EAS Project ID (UUID)</Text>
          <TextInput
            value={easProjectId}
            onChangeText={setEasProjectId}
            placeholder="5e5a7791-8751-416b-9a1f-831adfffcb6c"
            placeholderTextColor={theme.palette.input.placeholder}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={s.row}>
            <Btn label="EAS ID speichern" onPress={saveEasProjectId} />
          </View>
        </Section>

        <Text style={s.footerNote}>
          Läuft auf {Platform.OS === "ios" ? "iOS" : "Android"} – Expo SDK 54.
        </Text>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: 14 },
  h1: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  card: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.input.background,
  },
  row: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  btn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnPrimary: { backgroundColor: theme.palette.primary },
  btnText: { color: theme.palette.text.primary, fontWeight: "800" },
  muted: { color: theme.palette.text.secondary, fontSize: 12 },
  repoLine: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  hint: {
    marginTop: 10,
    color: theme.palette.text.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  footerNote: {
    marginTop: 10,
    color: theme.palette.text.muted,
    fontSize: 11,
  },
});
