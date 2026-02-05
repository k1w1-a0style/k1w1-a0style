import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "../../theme";

import { useConnectionsScreen } from "./hooks/useConnectionsScreen";
import { StatusCard } from "./components/StatusCard";
import { TokensCard } from "./components/TokensCard";
import { SupabaseCard } from "./components/SupabaseCard";
import { EasCard } from "./components/EasCard";

export default function ConnectionsScreen() {
  const {
    navigation,
    busy,

    // Repo/Status
    status,
    repoLine,
    supabaseUrl,
    easProjectId,

    // Tokens
    githubToken,
    setGithubToken,
    expoToken,
    setExpoToken,
    edgeAdminKey,
    setEdgeAdminKey,

    showGitHub,
    setShowGitHub,
    showExpo,
    setShowExpo,
    showEdge,
    setShowEdge,

    // Supabase
    supabaseRaw,
    setSupabaseRaw,
    setSupabaseUrl,
    supabaseAnonKey,
    setSupabaseAnonKey,
    supabaseServiceRoleKey,
    setSupabaseServiceRoleKey,

    // EAS
    setEasProjectId,

    // Actions
    saveAll,
    testGitHub,
    testSupabase,
  } = useConnectionsScreen();

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>Verbindungen</Text>

        <StatusCard
          styles={styles}
          busy={busy}
          status={status}
          repoLine={repoLine}
          supabaseUrl={supabaseUrl}
          easProjectId={easProjectId}
          onNavigateRepos={() => navigation.navigate("GitHubRepos")}
          onNavigateDiagnostic={() => navigation.navigate("Diagnostic")}
        />

        <TokensCard
          styles={styles}
          busy={busy}
          githubToken={githubToken}
          onChangeGitHubToken={setGithubToken}
          expoToken={expoToken}
          onChangeExpoToken={setExpoToken}
          edgeAdminKey={edgeAdminKey}
          onChangeEdgeAdminKey={setEdgeAdminKey}
          showGitHub={showGitHub}
          onToggleShowGitHub={() => setShowGitHub((p) => !p)}
          showExpo={showExpo}
          onToggleShowExpo={() => setShowExpo((p) => !p)}
          showEdge={showEdge}
          onToggleShowEdge={() => setShowEdge((p) => !p)}
          onSave={saveAll}
          onTestGitHub={testGitHub}
        />

        <SupabaseCard
          styles={styles}
          busy={busy}
          supabaseRaw={supabaseRaw}
          onChangeSupabaseRaw={setSupabaseRaw}
          supabaseUrl={supabaseUrl}
          onChangeSupabaseUrl={setSupabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
          onChangeSupabaseAnonKey={setSupabaseAnonKey}
          supabaseServiceRoleKey={supabaseServiceRoleKey}
          onChangeSupabaseServiceRoleKey={setSupabaseServiceRoleKey}
          onSave={saveAll}
          onTestSupabase={testSupabase}
        />

        <EasCard
          styles={styles}
          easProjectId={easProjectId}
          onChangeEasProjectId={setEasProjectId}
        />

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
