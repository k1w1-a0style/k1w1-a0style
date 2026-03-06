// components/CiLiteHeaderButton/components/ActionButtons.tsx
// Chat / Copy / Run / Patch / Autofix action bar at the bottom of the CI Lite modal.

import React from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { v4 as uuidv4 } from "uuid";
import * as Clipboard from "expo-clipboard";

import { theme } from "../../../theme";
import { safeUi } from "../../ciLite/ciLiteUtils";
import { styles } from "../styles";
import { WORKFLOW_CI_LITE_AUTOFIX } from "../types";
import type { ChatMessage } from "../../../shared/types/chat";

interface ActionButtonsProps {
  onlyErrors: string[];
  runUrl: string | null;
  workflowRunUrl: string | undefined;
  dispatching: boolean;
  // Some callers keep this synchronous (fire-and-forget).
  // `await` works for both sync + async functions.
  addChatMessage: (msg: ChatMessage) => void | Promise<void>;
  dispatchWorkflow: (workflowFile: string) => void;
  onOpenPatchPanel: () => void;
}

export function ActionButtons({
  onlyErrors, runUrl, workflowRunUrl, dispatching,
  addChatMessage, dispatchWorkflow, onOpenPatchPanel,
}: ActionButtonsProps) {
  const viewUrl = runUrl || workflowRunUrl;

  return (
    <View style={styles.actionsRow}>
      {/* Send errors to chat */}
      <Pressable
        onPress={async () => {
          const joined = safeUi(onlyErrors.join("\n"));
          if (!joined.trim()) {
            Alert.alert("CI Lite", "Keine Fehler gefunden – nichts an den Chat zu schicken.");
            return;
          }
          try {
            await addChatMessage({
              id: uuidv4(),
              role: "user",
              timestamp: new Date().toISOString(),
              content: `CI Lite Fehler (ESLint/Typecheck)\n\n${joined}`,
              meta: { error: true },
            });
            Alert.alert("In Chat übernommen", "Fehler wurden als Nachricht in den Chat eingefügt.");
          } catch {
            Alert.alert("Fehler", "Konnte die Nachricht nicht in den Chat schreiben.");
          }
        }}
        style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.palette.primary} />
        <Text style={styles.actionBtnText}>Chat</Text>
      </Pressable>

      {/* Copy errors */}
      <Pressable
        onPress={async () => {
          try {
            await Clipboard.setStringAsync(safeUi(onlyErrors.join("\n")) || "(keine Fehler)");
          } catch { /* ignore */ }
        }}
        style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
      >
        <Ionicons name="copy-outline" size={16} color={theme.palette.primary} />
        <Text style={styles.actionBtnText}>Copy</Text>
      </Pressable>

      {/* Open run in browser */}
      <Pressable
        onPress={async () => {
          if (!viewUrl) return;
          try {
            if (await Linking.canOpenURL(viewUrl)) await Linking.openURL(viewUrl);
          } catch { /* ignore */ }
        }}
        disabled={!viewUrl}
        style={({ pressed }) => [
          styles.actionBtn,
          !viewUrl && styles.actionBtnDisabled,
          pressed && !!viewUrl && styles.actionBtnPressed,
        ]}
      >
        <Ionicons name="open-outline" size={16} color={theme.palette.primary} />
        <Text style={styles.actionBtnText}>Run</Text>
      </Pressable>

      {/* Patch panel toggle */}
      <Pressable
        onPress={onOpenPatchPanel}
        style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
      >
        <Ionicons name="hammer-outline" size={16} color={theme.palette.primary} />
        <Text style={styles.actionBtnText}>Patch</Text>
      </Pressable>

      {/* Autofix dispatch */}
      <Pressable
        onPress={() => dispatchWorkflow(WORKFLOW_CI_LITE_AUTOFIX)}
        disabled={dispatching}
        style={({ pressed }) => [
          styles.actionBtn, styles.actionBtnPrimary,
          dispatching && styles.actionBtnDisabled,
          pressed && !dispatching && styles.actionBtnPressed,
        ]}
      >
        <Ionicons name="flash-outline" size={16} color={theme.palette.background} />
        <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
          {dispatching ? "…" : "Autofix"}
        </Text>
      </Pressable>
    </View>
  );
}
