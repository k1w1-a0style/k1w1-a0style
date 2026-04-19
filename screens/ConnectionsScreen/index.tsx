import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
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
import { resolveEasVerificationPresentation } from "./components/StatusCard";

import { styles } from "./styles";

export default function ConnectionsScreen() {
  const [showSyncSummary, setShowSyncSummary] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const debugEntries = useDebugEntries();
  const {
    navigation,
    ui,
    connection,
    tokens,
    visibility,
    supabase,
    eas,
    actions,
  } = useConnectionsScreen();

  const { busy, hydrated, isEasInitRunning, isTestingEas } = ui;
  const {
    status,
    repoLine,
    selectionSource,
    githubOk,
    githubUser,
    githubScopes,
    supabaseOk,
    supabaseRef,
    expoOk,
    expoUser,
    easOk,
  } = connection;
  const {
    githubToken,
    setGithubToken,
    expoToken,
    setExpoToken,
    workflowAdminKey,
    setWorkflowAdminKey,
    androidKeystoreExportAdminKey,
    setAndroidKeystoreExportAdminKey,
  } = tokens;
  const {
    showGitHub,
    setShowGitHub,
    showExpo,
    setShowExpo,
    showWorkflowAdmin,
    setShowWorkflowAdmin,
    showKeystoreAdmin,
    setShowKeystoreAdmin,
    showSupabaseAnon,
    setShowSupabaseAnon,
  } = visibility;
  const {
    supabaseRaw,
    setSupabaseRaw,
    supabaseUrl,
    setSupabaseUrl,
    supabaseAnonKey,
    setSupabaseAnonKey,
  } = supabase;
  const {
    easProjectId,
    setEasProjectId,
    easState,
    easLastVerifiedAt,
    testEas,
    onLinkExisting,
    onCreateAndLink,
  } = eas;
  const { saveAll, testGitHub, testSupabase, testExpo } = actions;

  const syncSummaryLines = useMemo(() => {
    const easSummary = resolveEasVerificationPresentation({
      easProjectId,
      easState,
      easLastVerifiedAt,
    });
    const lines: string[] = [];
    lines.push(`Repo: ${repoLine || "(kein Repo)"}`);
    lines.push(`GitHub: ${githubOk ? "✅" : "❌"}${githubUser ? ` (${githubUser})` : ""}`);
    if (githubScopes) lines.push(`GitHub Scopes: ${githubScopes}`);

    lines.push(`Supabase URL: ${supabaseUrl || "(leer)"}`);
    lines.push(`Supabase Ref: ${supabaseRef || "(leer)"}`);
    lines.push(`Supabase Status: ${supabaseOk ? "✅" : "❌"}`);

    lines.push(`Expo: ${expoOk ? "✅" : "❌"}${expoUser ? ` (${expoUser})` : ""}`);
    lines.push(`EAS Project ID: ${easProjectId || "(leer)"}`);
    lines.push(`EAS Status: ${easSummary.stateLabel}`);

    lines.push("");
    lines.push("Automatisch per Secret-Sync ins aktive Repo (Namen, keine Werte):");
    lines.push("- EXPO_TOKEN");
    lines.push("- SUPABASE_URL");
    lines.push("- EAS_PROJECT_ID (optional)");
    lines.push("- K1W1_EDGE_WORKFLOW_ADMIN_KEY (optional, scoped Workflow-Key)");
    lines.push("- K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY (optional, scoped Keystore-Key)");
    lines.push("");
    lines.push("Lokale App-Werte (SecureStore, getrennte Scopes):");
    lines.push(`- Workflow Admin Key: ${workflowAdminKey.trim() ? "gesetzt" : "leer"}`);
    lines.push(`- Android Keystore Export Admin Key: ${androidKeystoreExportAdminKey.trim() ? "gesetzt" : "leer"}`);
    lines.push("");
    lines.push("Nicht aus der App auto-synchronisiert:");
    lines.push("- GITHUB_TOKEN / SUPABASE_ANON_KEY (bleiben lokal auf dem Gerät)");
    return lines;
  }, [repoLine, githubOk, githubUser, githubScopes, supabaseUrl, supabaseRef, supabaseOk, expoOk, expoUser, easProjectId, easState, easLastVerifiedAt, workflowAdminKey, androidKeystoreExportAdminKey]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        testID="connections-screen-scroll"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <Text style={styles.h1}>Verbindungen</Text>
          <View style={styles.titleActions}>
            <Pressable
              testID="connections-debug-button"
              onPress={() => setDebugOpen(true)}
              style={({ pressed }) => [styles.summaryBtn, pressed && styles.summaryBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Debug overlay"
            >
              <Ionicons name="bug-outline" size={18} color={theme.palette.primary} />
            </Pressable>
            <Pressable
              testID="connections-sync-summary-button"
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
          busy={busy || !hydrated}
          easInitRunning={isEasInitRunning}
          status={status}
          repoLine={repoLine}
          selectionSource={selectionSource}
          supabaseUrl={supabaseUrl}
          supabaseRef={supabaseRef}
          easProjectId={easProjectId}
          easLastVerifiedAt={easLastVerifiedAt}
          githubOk={githubOk}
          githubUser={githubUser}
          githubScopes={githubScopes}
          supabaseOk={supabaseOk}
          expoOk={expoOk}
          expoUser={expoUser}
          easOk={easOk}
          easState={easState}
          onNavigateRepos={() => navigation.navigate("GitHubRepos")}
          onNavigateDiagnostic={() => navigation.navigate("Diagnostic")}
          onNavigateBuild={() => navigation.navigate("EnhancedBuild")}
        />

        <TokensCard
          styles={styles}
          busy={busy || !hydrated}
          githubToken={githubToken}
          onChangeGitHubToken={setGithubToken}
          expoToken={expoToken}
          onChangeExpoToken={setExpoToken}
          workflowAdminKey={workflowAdminKey}
          onChangeWorkflowAdminKey={setWorkflowAdminKey}
          androidKeystoreExportAdminKey={androidKeystoreExportAdminKey}
          onChangeAndroidKeystoreExportAdminKey={setAndroidKeystoreExportAdminKey}
          showGitHub={showGitHub}
          onToggleShowGitHub={() => setShowGitHub((p) => !p)}
          showExpo={showExpo}
          onToggleShowExpo={() => setShowExpo((p) => !p)}
          showWorkflowAdmin={showWorkflowAdmin}
          onToggleShowWorkflowAdmin={() => setShowWorkflowAdmin((p) => !p)}
          showKeystoreAdmin={showKeystoreAdmin}
          onToggleShowKeystoreAdmin={() => setShowKeystoreAdmin((p) => !p)}
          onSave={saveAll}
          onTestGitHub={testGitHub}
          onTestExpo={testExpo}
        />

        <SupabaseCard
          styles={styles}
          busy={busy || !hydrated}
          supabaseRaw={supabaseRaw}
          onChangeSupabaseRaw={setSupabaseRaw}
          supabaseUrl={supabaseUrl}
          supabaseRef={supabaseRef}
          onChangeSupabaseUrl={setSupabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
          onChangeSupabaseAnonKey={setSupabaseAnonKey}
          showSupabaseAnon={showSupabaseAnon}
          onToggleShowSupabaseAnon={() => setShowSupabaseAnon((p) => !p)}
          onSave={saveAll}
          onTestSupabase={testSupabase}
        />

        <EasCard
          styles={styles}
          busy={!hydrated || busy || isTestingEas || isEasInitRunning}
          easProjectId={easProjectId}
          onChangeEasProjectId={setEasProjectId}
          onTestEas={() => void testEas()}
          onLinkExisting={() => void onLinkExisting()}
          onCreateAndLink={() => void onCreateAndLink()}
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
