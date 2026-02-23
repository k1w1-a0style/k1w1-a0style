import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { theme } from "../../../theme";
import { styles as base } from "../../../styles/enhancedBuildScreenStyles";
import { logger } from "../../../lib/logger";
import type { WorkflowRun } from "../types";
import type {
  WorkflowJob,
  WorkflowRunDetails,
} from "../../../infra/github/workflows";

type MatchInfo = {
  jobId?: string | null;
  buildProfile?: string | null;
  branch?: string | null;
  repoName?: string | null;
};

export function WorkflowRunDetailModal({
  visible,
  onClose,
  run,
  details,
  jobs,
  loading,
  error,
  onRefresh,
  onOpenUrl,
  match,
}: {
  visible: boolean;
  onClose: () => void;
  run: WorkflowRun | null;
  details: WorkflowRunDetails | null;
  jobs: WorkflowJob[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenUrl: (url: string) => void;
  match?: MatchInfo | null;
}): React.ReactElement {
  const title = (run as any)?.display_title || run?.name || "Workflow";
  const status = run?.status ? String(run.status) : "";
  const conclusion = run?.conclusion ? String(run.conclusion) : null;
  const actor = details?.actor?.login || details?.triggering_actor?.login || null;

  const copyText = async (text: string, label: string) => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      // lightweight feedback via title (no Alert spam)
      logger.info(`[Clipboard] Copied: ${label}`);
    } catch {
      // ignore
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={theme.palette.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <View style={base.statusRow}>
              <Text style={base.statusEmoji}>⚙️</Text>
              <View style={base.statusTextWrap}>
                <Text style={base.statusLabel}>
                  {status}{conclusion ? ` / ${conclusion}` : ""}
                </Text>
                <Text style={base.statusMessage} numberOfLines={2}>
                  Run-ID: #{run?.id ?? "-"}
                  {run?.run_number ? ` • #${run.run_number}` : ""}
                  {run?.head_branch ? ` • ${run.head_branch}` : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onRefresh}
                style={[base.inlineLink, loading && base.btnDisabled]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.palette.primary} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color={theme.palette.primary} />
                    <Text style={base.inlineLinkText}>Refresh</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {!!error && (
              <View style={base.errorBox}>
                <Text style={base.errorText}>⚠️ {error}</Text>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.sectionTitle}>Infos</Text>
              <InfoRow label="Repo" value={details?.repository?.full_name || match?.repoName || "-"} />
              <InfoRow label="Branch" value={run?.head_branch || match?.branch || "-"} />
              <InfoRow label="Event" value={details?.event || (run as any)?.event || "-"} />
              <InfoRow label="Actor" value={actor || "-"} />
              <InfoRow label="Started" value={run?.created_at ? new Date(run.created_at).toLocaleString() : "-"} />
              <InfoRow label="Updated" value={run?.updated_at ? new Date(run.updated_at).toLocaleString() : "-"} />
            </View>

            {match && (match.jobId || match.buildProfile || match.branch) && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>Inputs (aus App)</Text>
                <View style={s.rowBetween}>
                  <InfoRow label="Job-ID" value={match.jobId || "-"} mono />
                  {!!match.jobId && (
                    <TouchableOpacity
                      onPress={() => copyText(String(match.jobId), "Job-ID")}
                      style={s.smallBtn}
                      activeOpacity={0.75}
                      accessibilityLabel="Job-ID kopieren"
                    >
                      <Ionicons name="copy-outline" size={14} color={theme.palette.primary} />
                      <Text style={s.smallBtnText}>Copy</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <InfoRow label="Build" value={match.buildProfile || "-"} />
                <InfoRow label="Branch" value={match.branch || "-"} />
              </View>
            )}

            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.sectionTitle}>Jobs</Text>
                <Text style={s.badge}>{jobs.length}</Text>
              </View>

              {loading && jobs.length === 0 ? (
                <View style={{ paddingVertical: 10 }}>
                  <ActivityIndicator color={theme.palette.primary} />
                </View>
              ) : jobs.length === 0 ? (
                <Text style={s.muted}>Keine Jobs gefunden (oder keine Berechtigung).</Text>
              ) : (
                <View style={{ gap: 10, marginTop: 10 }}>
                  {jobs.map((j) => (
                    <View key={j.id} style={s.jobCard}>
                      <View style={s.rowBetween}>
                        <Text style={s.jobTitle} numberOfLines={1}>
                          {j.name}
                        </Text>
                        <Text style={s.jobId}>#{j.id}</Text>
                      </View>
                      <Text style={s.jobMeta}>
                        {j.status}{j.conclusion ? ` / ${j.conclusion}` : ""}
                        {j.started_at ? ` • ${new Date(j.started_at).toLocaleTimeString()}` : ""}
                      </Text>
                      <View style={s.jobActions}>
                        {!!j.html_url && (
                          <TouchableOpacity
                            onPress={() => {
                              const url = String(j.html_url ?? "");
                              if (url) onOpenUrl(url);
                            }}
                            style={s.jobBtn}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="open-outline" size={14} color={theme.palette.primary} />
                            <Text style={s.jobBtnText}>Open</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {!!j.steps && j.steps.length > 0 && (
                        <View style={{ marginTop: 10, gap: 6 }}>
                          {j.steps.slice(0, 8).map((st) => (
                            <Text key={`${j.id}-${st.name}`} style={s.stepLine} numberOfLines={1}>
                              • {st.name} ({st.status}{st.conclusion ? `/${st.conclusion}` : ""})
                            </Text>
                          ))}
                          {j.steps.length > 8 && (
                            <Text style={s.muted}>+ {j.steps.length - 8} weitere Steps</Text>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {!!run?.html_url && (
              <View style={{ gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={base.primaryBtn}
                  onPress={() => onOpenUrl(run.html_url)}
                >
                  <Text style={base.primaryBtnText}>↗️ Run in GitHub öffnen</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={base.secondaryBtn}
                  onPress={() => copyText(run.html_url || "", "Run URL")}
                  activeOpacity={0.8}
                >
                  <Text style={base.secondaryBtnText}>📋 Link kopieren</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.ReactElement {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.mono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "92%",
    backgroundColor: theme.palette.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    color: theme.palette.text.primary,
    paddingRight: 12,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
  },
  content: {
    padding: 16,
    paddingBottom: 26,
  },
  card: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.palette.card,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.palette.text.primary,
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.palette.primary,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.palette.background,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 8,
  },
  infoLabel: {
    width: 90,
    fontSize: 11,
    fontWeight: "800",
    color: theme.palette.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: theme.palette.text.secondary,
    textAlign: "right",
  },
  mono: {
    fontFamily: "monospace",
  },
  jobCard: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.palette.background,
  },
  jobTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: theme.palette.text.primary,
    paddingRight: 10,
  },
  jobId: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.palette.text.muted,
  },
  jobMeta: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 6,
  },
  jobActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    marginLeft: 10,
  },
  smallBtnText: {
    fontSize: 12,
    color: theme.palette.primary,
    fontWeight: "800",
  },
  jobBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  jobBtnText: {
    fontSize: 12,
    color: theme.palette.primary,
    fontWeight: "800",
  },
  stepLine: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  muted: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
});