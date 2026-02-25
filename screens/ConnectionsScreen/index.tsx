import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { clearDebugEntries } from "../../lib/debugOverlay";
import { useDebugEntries } from "../../hooks/useDebugEntries";

import { useConnectionsScreen } from "./hooks/useConnectionsScreen";
import { StatusCard } from "./components/StatusCard";
import { TokensCard } from "./components/TokensCard";
import { SupabaseCard } from "./components/SupabaseCard";
import { EasCard } from "./components/EasCard";

export default function ConnectionsScreen() {
  const [showSyncSummary, setShowSyncSummary] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const debugEntries = useDebugEntries();
  const {
    navigation,
    busy,

    isEasInitRunning,

    // Repo/Status
    status,
    repoLine,
    supabaseUrl,
    easProjectId,

    // Connection lights
    githubOk,
    githubUser,
    githubScopes,
    supabaseOk,
    supabaseRef,
    expoOk,
    expoUser,
    easOk,

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

    showSupabaseAnon,
    setShowSupabaseAnon,
    showSupabaseServiceRole,
    setShowSupabaseServiceRole,

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
    testExpo,
  } = useConnectionsScreen();

  const syncSummaryLines = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Repo: ${repoLine || "(kein Repo)"}`);
    lines.push(`GitHub: ${githubOk ? "✅" : "❌"}${githubUser ? ` (${githubUser})` : ""}`);
    if (githubScopes) lines.push(`GitHub Scopes: ${githubScopes}`);

    lines.push(`Supabase URL: ${supabaseUrl || "(leer)"}`);
    lines.push(`Supabase Ref: ${supabaseRef || "(leer)"}`);
    lines.push(`Supabase Status: ${supabaseOk ? "✅" : "❌"}`);

    lines.push(`Expo: ${expoOk ? "✅" : "❌"}${expoUser ? ` (${expoUser})` : ""}`);
    lines.push(`EAS Project ID: ${easProjectId || "(leer)"}`);
    lines.push(`EAS Status: ${easOk ? "✅" : "❌"}`);

    lines.push("");
    lines.push("Wird beim Sync ins Repo/Supabase geschrieben (Namen, keine Werte):");
    lines.push("- GITHUB_TOKEN");
    lines.push("- EXPO_TOKEN");
    lines.push("- EDGE_ADMIN_KEY");
    lines.push("- SUPABASE_SERVICE_ROLE_KEY");
    lines.push("- SUPABASE_ANON_KEY");
    lines.push("- EAS_PROJECT_ID");
    return lines;
  }, [repoLine, githubOk, githubUser, githubScopes, supabaseUrl, supabaseRef, supabaseOk, expoOk, expoUser, easProjectId, easOk]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <Text style={styles.h1}>Verbindungen</Text>
          <View style={styles.titleActions}>
            <Pressable
              onPress={() => setDebugOpen(true)}
              style={({ pressed }) => [styles.summaryBtn, pressed && styles.summaryBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Debug overlay"
            >
              <Ionicons name="bug-outline" size={18} color={theme.palette.primary} />
            </Pressable>
            <Pressable
              onPress={() => setShowSyncSummary(true)}
              style={({ pressed }) => [styles.summaryBtn, pressed && styles.summaryBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Sync Summary"
            >
              <Ionicons name="list-outline" size={18} color={theme.palette.primary} />
            </Pressable>
          </View>
        </View>

        <StatusCard
          styles={styles}
          busy={busy}
          easInitRunning={isEasInitRunning}
          status={status}
          repoLine={repoLine}
          supabaseUrl={supabaseUrl}
          supabaseRef={supabaseRef}
          easProjectId={easProjectId}
          githubOk={githubOk}
          githubUser={githubUser}
          githubScopes={githubScopes}
          supabaseOk={supabaseOk}
          expoOk={expoOk}
          expoUser={expoUser}
          easOk={easOk}
          onNavigateRepos={() => navigation.navigate("GitHubRepos")}
          onNavigateDiagnostic={() => navigation.navigate("Diagnostic")}
          onNavigateBuild={() => navigation.navigate("EnhancedBuild")}
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
          onTestExpo={testExpo}
        />

        <SupabaseCard
          styles={styles}
          busy={busy}
          supabaseRaw={supabaseRaw}
          onChangeSupabaseRaw={setSupabaseRaw}
          supabaseUrl={supabaseUrl}
          supabaseRef={supabaseRef}
          onChangeSupabaseUrl={setSupabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
          onChangeSupabaseAnonKey={setSupabaseAnonKey}
          supabaseServiceRoleKey={supabaseServiceRoleKey}
          onChangeSupabaseServiceRoleKey={setSupabaseServiceRoleKey}
          showSupabaseAnon={showSupabaseAnon}
          onToggleShowSupabaseAnon={() => setShowSupabaseAnon((p) => !p)}
          showSupabaseServiceRole={showSupabaseServiceRole}
          onToggleShowSupabaseServiceRole={() =>
            setShowSupabaseServiceRole((p) => !p)
          }
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

      <Modal
        visible={debugOpen}
        animationType="slide"
        onRequestClose={() => setDebugOpen(false)}
      >
        <SafeAreaView style={styles.debugWrap} edges={[]}> 
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>Debug Overlay</Text>
            <View style={styles.debugHeaderActions}>
              <Pressable
                accessibilityLabel="Clear debug"
                onPress={() => clearDebugEntries()}
                style={({ pressed }) => [styles.debugAction, pressed && styles.debugActionPressed]}
              >
                <Ionicons name="trash-outline" size={18} color={theme.palette.text.primary} />
              </Pressable>
              <Pressable
                accessibilityLabel="Close debug"
                onPress={() => setDebugOpen(false)}
                style={({ pressed }) => [styles.debugAction, pressed && styles.debugActionPressed]}
              >
                <Ionicons name="close" size={20} color={theme.palette.text.primary} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.debugList} contentContainerStyle={styles.debugListContent}>
            {debugEntries.length === 0 ? (
              <Text style={styles.debugEmpty}>Noch keine Logs…</Text>
            ) : (
              debugEntries.map((e, idx) => (
                <View key={`${e.ts}-${idx}`} style={styles.debugItem}>
                  <Text style={styles.debugMeta}>
                    {new Date(e.ts).toLocaleTimeString()} • {e.scope}
                  </Text>
                  <Text style={styles.debugMsg}>{e.message}</Text>
                  {e.data ? (
                    <Text style={styles.debugData}>{JSON.stringify(e.data, null, 2)}</Text>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showSyncSummary}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSyncSummary(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSyncSummary(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sync Summary</Text>
              <Pressable
                onPress={() => setShowSyncSummary(false)}
                style={({ pressed }) => [styles.modalClose, pressed && styles.modalClosePressed]}
              >
                <Ionicons name="close" size={18} color={theme.palette.primary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {syncSummaryLines.map((l, idx) => (
                <Text key={`${idx}-${l.slice(0, 12)}`} style={styles.modalLine}>
                  {l}
                </Text>
              ))}
            </ScrollView>
            <Text style={styles.modalHint}>
              Tipp: Wenn du Keys/IDs änderst, danach immer einmal „Speichern“ und dann „Sync“ drücken.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: 16, paddingBottom: 40 },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBtnPressed: {
    backgroundColor: theme.palette.userBubble.background,
  },

  h1: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginBottom: 6,
  },

  debugWrap: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  debugHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  debugTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  debugHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  debugAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.card,
  },
  debugActionPressed: {
    backgroundColor: theme.palette.userBubble.background,
  },
  debugList: { flex: 1 },
  debugListContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  debugEmpty: {
    color: theme.palette.text.muted,
    fontSize: 13,
  },
  debugItem: {
    backgroundColor: theme.palette.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  debugMeta: {
    color: theme.palette.text.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  debugMsg: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  debugData: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontFamily: "Courier",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  modalClosePressed: {
    backgroundColor: theme.palette.userBubble.background,
  },
  modalLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginBottom: 6,
  },
  modalHint: {
    marginTop: 10,
    color: theme.palette.text.secondary,
    fontSize: 12,
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
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.palette.primary,
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
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
    flexWrap: "wrap",
    maxWidth: "75%",
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
