// components/CiLiteHeaderButton/components/CiLiteModal.tsx
// The full-screen modal overlay showing CI Lite run status, logs, and actions.

import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import { safeUi } from "../../ciLite/ciLiteUtils";
import { styles } from "../styles";
import type { RunMeta, StepState } from "../types";
import type { ChatMessage } from "../../../shared/types/chat";

import { StatusLamp, AnimatedDots } from "./StatusIndicators";
import { ProgressBar } from "./ProgressBar";
import { PatchPanel } from "./PatchPanel";
import { ActionButtons } from "./ActionButtons";
import type { Animated } from "react-native";

interface CiLiteModalProps {
  visible: boolean;
  onClose: () => void;

  // Status
  isAutofix: boolean;
  statusText: string;
  statusLamp: StepState;
  busy: boolean;
  done: boolean;
  ok: boolean;
  showError: string;
  artifactNotice: string;

  // Meta
  githubRepo: string;
  targetRef: string | null;
  branch: string;
  jobId: string | null;
  stepInfo: { lint: StepState; typecheck: StepState };
  runMeta: RunMeta | null;
  hydratedFromPersistence: boolean;

  // Logs
  onlyErrors: string[];

  // Progress
  progressAnim: Animated.Value;
  shimmerAnim: Animated.Value;
  progressPctClamped: number;
  progressLabel: string;

  // Patch
  patchPanelOpen: boolean;
  patchText: string;
  onChangePatchText: (t: string) => void;
  patchBusy: boolean;
  patchInfo: string | null;
  onPaste: () => void;
  onValidate: () => void;
  onApply: () => void;
  onClosePatch: () => void;
  onOpenPatchPanel: () => void;

  // Actions
  runUrl: string | null;
  workflowRunUrl: string | undefined;
  dispatching: boolean;
  isTrackingRun: boolean;
  addChatMessage: (msg: ChatMessage) => void | Promise<void>;
  dispatchWorkflow: (workflowFile: string) => void;
}

export function CiLiteModal(props: CiLiteModalProps) {
  const {
    visible, onClose, isAutofix, statusText, statusLamp, busy, done, ok, showError, artifactNotice,
    githubRepo, targetRef, branch, jobId, stepInfo, runMeta, hydratedFromPersistence,
    onlyErrors,
    progressAnim, shimmerAnim, progressPctClamped, progressLabel,
    patchPanelOpen, patchText, onChangePatchText, patchBusy, patchInfo,
    onPaste, onValidate, onApply, onClosePatch, onOpenPatchPanel,
    runUrl, workflowRunUrl, dispatching, isTrackingRun, addChatMessage, dispatchWorkflow,
  } = props;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {/* Header */}
          <View style={styles.modalHeaderRow}>
            <View style={styles.modalTitleRow}>
              <StatusLamp state={statusLamp} size={10} />
              <Text style={styles.modalTitle}>{isAutofix ? "Autofix ESLint" : "CI Lite"}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Ionicons name="close" size={18} color={theme.palette.primary} />
            </Pressable>
          </View>

          {/* Status + Progress */}
          <View style={styles.statusRow}>
            <View style={styles.statusTopRow}>
              <Text style={styles.statusText}>{statusText}</Text>
              <AnimatedDots active={busy} />
              {busy ? <ActivityIndicator size="small" color={theme.palette.primary} style={{ marginLeft: 8 }} /> : null}
            </View>

            <ProgressBar
              progressAnim={progressAnim}
              shimmerAnim={shimmerAnim}
              progressPctClamped={progressPctClamped}
              label={progressLabel}
              busy={busy}
            />
          </View>

          {/* Meta box */}
          <View style={styles.metaBox}>
            <Text style={styles.metaLine} numberOfLines={1}>Repo: {githubRepo || "(kein Repo)"}</Text>
            <Text style={styles.metaLine} numberOfLines={1}>Branch: {targetRef || branch || "(auto)"}</Text>
            {jobId ? <Text style={styles.metaLine} numberOfLines={1}>job_id: {jobId}</Text> : null}

            <View style={styles.stepsCompactRow}>
              <View style={styles.stepCompact}>
                <StatusLamp state={stepInfo.lint} size={9} />
                <Text style={styles.stepCompactText}>ESLint</Text>
              </View>
              <View style={styles.stepCompact}>
                <StatusLamp state={stepInfo.typecheck} size={9} />
                <Text style={styles.stepCompactText}>Typecheck</Text>
              </View>
            </View>

            {hydratedFromPersistence ? (
              <Text style={styles.persistedHint}>Zuletzt bekannter Abschluss aus passender Persistenz.</Text>
            ) : null}

            {runMeta ? (
              <View style={styles.runMetaRow}>
                <Text style={styles.metaLine} numberOfLines={1}>
                  Run #{runMeta.runNumber} · {runMeta.status} · {String(runMeta.conclusion)} · {runMeta.duration}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Error */}
          {showError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={theme.palette.error} />
              <View style={styles.messageTextWrap}>
                <Text style={styles.errorTitle}>Workflow-/Run-Problem</Text>
                <Text style={styles.errorText}>{showError}</Text>
              </View>
            </View>
          ) : null}

          {artifactNotice ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={16} color={theme.palette.warning} />
              <View style={styles.messageTextWrap}>
                <Text style={styles.warningTitle}>Artifact-/Nachzug-Problem</Text>
                <Text style={styles.warningText}>{artifactNotice}</Text>
              </View>
            </View>
          ) : null}

          {/* Results */}
          <View style={styles.resultsHead}>
            <Text style={styles.resultsTitle}>Ergebnisse</Text>
            {done ? (
              ok ? <Text style={styles.okText}>✅ OK</Text> : <Text style={styles.badText}>❌ Fehler</Text>
            ) : (
              <Text style={styles.waitText}>…</Text>
            )}
          </View>

          <View style={styles.resultsBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {done && ok && onlyErrors.length === 0 ? (
                <Text style={styles.okHint}>Keine Fehler gefunden.</Text>
              ) : null}
              {onlyErrors.map((l, idx) => (
                <Text key={`${idx}-${l.slice(0, 24)}`} style={styles.logLine}>
                  {safeUi(l)}
                </Text>
              ))}
            </ScrollView>
          </View>

          {/* Patch panel */}
          {patchPanelOpen ? (
            <PatchPanel
              patchText={patchText}
              onChangePatchText={onChangePatchText}
              patchBusy={patchBusy}
              patchInfo={patchInfo}
              onPaste={onPaste}
              onValidate={onValidate}
              onApply={onApply}
              onClose={onClosePatch}
            />
          ) : null}

          {/* Action buttons */}
          <ActionButtons
            onlyErrors={onlyErrors}
            runUrl={runUrl}
            workflowRunUrl={workflowRunUrl}
            dispatching={dispatching}
            isTrackingRun={isTrackingRun}
            addChatMessage={addChatMessage}
            dispatchWorkflow={dispatchWorkflow}
            onOpenPatchPanel={onOpenPatchPanel}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
