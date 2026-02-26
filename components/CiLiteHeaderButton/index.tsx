// components/CiLiteHeaderButton/index.tsx
// Refactored: 1599 lines → ~80 lines (logic in hooks, UI in sub-components).
//
// Structure:
//   hooks/useCiLiteWorkflow.ts    – dispatch, polling, chain-runs, log state
//   hooks/useCiLitePatch.ts       – patch validation, apply, auto-sync
//   hooks/useCiLiteAnimations.ts  – progress bar, shimmer, pulse ring
//   components/CiLiteModal.tsx    – modal overlay
//   components/ActionButtons.tsx  – bottom action bar
//   components/PatchPanel.tsx     – patch JSON input
//   components/ProgressBar.tsx    – animated progress bar
//   components/StatusIndicators.tsx – StatusLamp, AnimatedDots, StepPill
//   styles.ts                     – all StyleSheet definitions
//   types.ts                      – shared types & constants

import React from "react";
import { Animated, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { useProject } from "../../contexts/ProjectContext";
import { styles } from "./styles";
import { WORKFLOW_CI_LITE } from "./types";
import { useCiLiteWorkflow } from "./hooks/useCiLiteWorkflow";
import { useCiLitePatch } from "./hooks/useCiLitePatch";
import { useCiLiteAnimations } from "./hooks/useCiLiteAnimations";
import { CiLiteModal } from "./components/CiLiteModal";

export default function CiLiteHeaderButton(): React.ReactElement {
  const { addChatMessage } = useProject();

  const wf = useCiLiteWorkflow();
  const patch = useCiLitePatch({ githubRepo: wf.githubRepo, branch: wf.branch });
  const anim = useCiLiteAnimations({
    headerState: wf.headerState,
    visible: wf.visible,
    dispatching: wf.dispatching,
    logsLoading: wf.logsLoading,
    workflowStatus: wf.workflowRun?.status,
    stepInfo: wf.stepInfo,
    done: wf.done,
    ok: wf.ok,
    busy: wf.busy,
  });

  const closeModal = () => { wf.setVisible(false); wf.stopPolling(); };

  return (
    <>
      {/* Header icon */}
      <Pressable
        onPress={() => { wf.setVisible(true); wf.dispatchWorkflow(WORKFLOW_CI_LITE); }}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && styles.iconBtnPressed,
          wf.headerState === "running" && styles.ciBtnRunning,
        ]}
        accessibilityLabel="CI Lite (Lint + Typecheck)"
        android_ripple={{ color: `${theme.palette.primary}22`, borderless: true }}
      >
        <View style={styles.ciIconWrap}>
          {wf.headerState === "running" ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {
                  opacity: anim.ringAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.9, 0.45, 0.1] }),
                  transform: [{ scale: anim.ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
                },
              ]}
            />
          ) : null}
          <Ionicons
            name={
              wf.headerState === "success" ? "checkmark-circle"
              : wf.headerState === "failure" ? "close-circle"
              : "checkmark-circle-outline"
            }
            size={22}
            color={wf.headerState === "failure" ? theme.palette.error : theme.palette.primary}
          />
        </View>
      </Pressable>

      {/* Modal */}
      <CiLiteModal
        visible={wf.visible}
        onClose={closeModal}
        isAutofix={wf.isAutofix}
        statusText={anim.statusText}
        statusLamp={anim.statusLamp}
        busy={wf.busy}
        done={wf.done}
        ok={wf.ok}
        showError={wf.showError}
        githubRepo={wf.githubRepo}
        targetRef={wf.targetRef}
        branch={wf.branch}
        jobId={wf.jobId}
        stepInfo={wf.stepInfo}
        runMeta={wf.runMeta}
        onlyErrors={wf.onlyErrors}
        progressAnim={anim.progressAnim}
        shimmerAnim={anim.shimmerAnim}
        progressPctClamped={anim.progressPctClamped}
        progressLabel={anim.progressTarget.label}
        patchPanelOpen={patch.patchPanelOpen}
        patchText={patch.patchText}
        onChangePatchText={patch.setPatchText}
        patchBusy={patch.patchBusy}
        patchInfo={patch.patchInfo}
        onPaste={patch.pastePatchFromClipboard}
        onValidate={patch.validatePatchAndShow}
        onApply={patch.applyPatchFromText}
        onClosePatch={() => patch.setPatchPanelOpen(false)}
        onOpenPatchPanel={() => { patch.setPatchPanelOpen(true); }}
        runUrl={wf.runUrl}
        workflowRunUrl={wf.workflowRun?.html_url}
        dispatching={wf.dispatching}
        addChatMessage={addChatMessage}
        dispatchWorkflow={wf.dispatchWorkflow}
      />
    </>
  );
}
