/**
 * BuildTimelineCard
 * Zeigt den Build-Fortschritt als Timeline an
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BuildStatus } from "../../lib/buildStatusMapper";
import { TIMELINE_STEPS, getStepState } from "../../utils/buildScreenUtils";
import { theme } from "../../theme";

interface BuildTimelineCardProps {
  status: BuildStatus;
}

export function BuildTimelineCard({ status }: BuildTimelineCardProps) {
  return (
    <View style={styles.timelineCard}>
      <Text style={styles.cardTitle}>📋 Ablauf</Text>
      {TIMELINE_STEPS.map((step, index) => {
        const state = getStepState(status, step.key);
        return (
          <View key={step.key} style={styles.timelineRow}>
            <View style={styles.timelineIconWrapper}>
              <View
                style={[
                  styles.timelineIcon,
                  state === "done" && styles.timelineIconDone,
                  state === "current" && styles.timelineIconCurrent,
                  state === "failed" && styles.timelineIconFailed,
                ]}
              >
                {state === "done" && (
                  <Text style={styles.timelineIconText}>✓</Text>
                )}
                {state === "current" && (
                  <Text style={styles.timelineIconText}>•</Text>
                )}
                {state === "failed" && (
                  <Text style={styles.timelineIconText}>!</Text>
                )}
              </View>
              {index !== TIMELINE_STEPS.length - 1 && (
                <View style={styles.timelineConnector} />
              )}
            </View>

            <View style={styles.timelineTextWrapper}>
              <Text style={styles.timelineLabel}>{step.label}</Text>
              <Text style={styles.timelineDescription}>{step.description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timelineCard: {
    marginTop: 6,
    marginBottom: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  timelineRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  timelineIconWrapper: {
    width: 30,
    alignItems: "center",
  },
  timelineIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIconDone: {
    borderColor: theme.palette.success,
    backgroundColor: theme.palette.success + "30",
  },
  timelineIconCurrent: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primary + "25",
  },
  timelineIconFailed: {
    borderColor: theme.palette.error,
    backgroundColor: theme.palette.error + "20",
  },
  timelineIconText: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: theme.palette.border,
    marginTop: 2,
  },
  timelineTextWrapper: {
    flex: 1,
    paddingLeft: 12,
  },
  timelineLabel: {
    color: theme.palette.text.primary,
    fontWeight: "600",
  },
  timelineDescription: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
});
