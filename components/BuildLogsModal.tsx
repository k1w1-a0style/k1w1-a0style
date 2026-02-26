import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,

  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../theme";
import { redactSecrets, truncateWithMarker } from "../lib/secretRedaction";

import { styles } from "./BuildLogsModal.styles";

export type BuildLogsModalProps = {
  visible: boolean;
  onClose: () => void;
  logs: string[];
  isLoading: boolean;
  error: string | null;

  /** Optional modal title (default: "Build Logs"). */
  title?: string;

  /** Optional content rendered above the log output (e.g. summary, progress). */
  topContent?: React.ReactNode;

  /** Optional extra pill buttons (besides the built-in ones). */
  extraPills?: Array<{
    label: string;
    onPress: () => void | Promise<void>;
    disabled?: boolean;
  }>;

  /** Auto-refresh state is controlled by parent (hook in screen) */
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: (enabled: boolean) => void;

  /** Optional: manual refresh button */
  onManualRefresh?: () => void | Promise<void>;

  /** When opening the modal, start with errors-only enabled */
  defaultOnlyErrors?: boolean;
};

const ERROR_RE = /(error|failed|exception|traceback|fatal|cannot|undefined)/i;
const MAX_CLIPBOARD_CHARS = 200_000;
const CLIP_TRUNC_MARK = "\n…<truncated>";

function sanitizeUiText(input: string): string {
  return truncateWithMarker(redactSecrets(input || ""), 800, "…");
}

function isErrorLine(line: string): boolean {
  return ERROR_RE.test(line);
}

export function BuildLogsModal({
  visible,
  onClose,
  logs,
  isLoading,
  error,
  title = "Build Logs",
  topContent,
  extraPills,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  onManualRefresh,
  defaultOnlyErrors = false,
}: BuildLogsModalProps): React.ReactElement {
  const scrollRef = useRef<ScrollView | null>(null);

  const [onlyErrors, setOnlyErrors] = useState<boolean>(defaultOnlyErrors);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset defaults when modal opens
  useEffect(() => {
    if (visible) {
      setOnlyErrors(defaultOnlyErrors);
      setCopied(false);
    }
  }, [visible, defaultOnlyErrors]);

  // Cleanup timeout on unmount / close
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
    };
  }, []);

  const filtered = useMemo(() => {
    if (!onlyErrors) return logs;
    return logs.filter(isErrorLine);
  }, [logs, onlyErrors]);

  const logEntries = useMemo(
    () =>
      filtered.map((line, idx) => ({
        id: `log-${idx}`,
        line,
        isError: isErrorLine(line),
      })),
    [filtered],
  );

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (!visible) return;
    if (!autoScroll) return;
    // Small delay to allow layout
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 30);
    return () => clearTimeout(t);
  }, [visible, autoScroll, logs.length]);

  const copyToClipboard = async (): Promise<void> => {
    try {
      const joined = filtered.join("\n");
      // Double-sanitize as defense-in-depth (even though hook already redacts).
      const content = truncateWithMarker(
        redactSecrets(joined),
        MAX_CLIPBOARD_CHARS,
        CLIP_TRUNC_MARK,
      );
      await Clipboard.setStringAsync(content || "(leer)");
      setCopied(true);

      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      // Avoid leaking potential secrets via console.
      console.error("Copy failed");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>

          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close logs"
            style={styles.modalCloseButton}
          >
            <Ionicons
              name="close"
              size={22}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.logsControlsRow}>
          <TouchableOpacity
            style={[styles.pill, onlyErrors && styles.pillActive]}
            onPress={() => setOnlyErrors((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle errors only"
            accessibilityState={{ checked: onlyErrors }}
          >
            <Text style={styles.pillText}>
              {onlyErrors ? "Errors only ✓" : "Errors only"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, autoRefreshEnabled && styles.pillActive]}
            onPress={() => onToggleAutoRefresh(!autoRefreshEnabled)}
            accessibilityRole="button"
            accessibilityLabel="Toggle auto refresh"
            accessibilityState={{ checked: autoRefreshEnabled }}
          >
            <Text style={styles.pillText}>
              {autoRefreshEnabled ? "Auto-Refresh ✓" : "Auto-Refresh"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, autoScroll && styles.pillActive]}
            onPress={() => setAutoScroll((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle auto scroll"
            accessibilityState={{ checked: autoScroll }}
          >
            <Text style={styles.pillText}>
              {autoScroll ? "Auto-Scroll ✓" : "Auto-Scroll"}
            </Text>
          </TouchableOpacity>

          {onManualRefresh ? (
            <TouchableOpacity
              style={styles.pill}
              onPress={onManualRefresh}
              accessibilityRole="button"
              accessibilityLabel="Refresh logs"
            >
              <Text style={styles.pillText}>Refresh</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.pill}
            onPress={copyToClipboard}
            accessibilityRole="button"
            accessibilityLabel="Copy logs"
            accessibilityState={{ disabled: filtered.length === 0 }}
          >
            <Text style={styles.pillText}>
              {copied ? "Kopiert ✓" : "Copy Logs"}
            </Text>
          </TouchableOpacity>

          {Array.isArray(extraPills)
            ? extraPills.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.pill, p.disabled && styles.pillDisabled]}
                  onPress={p.onPress}
                  disabled={!!p.disabled}
                  accessibilityRole="button"
                  accessibilityLabel={p.label}
                  accessibilityState={{ disabled: !!p.disabled }}
                >
                  <Text style={styles.pillText}>{p.label}</Text>
                </TouchableOpacity>
              ))
            : null}
        </View>

        {topContent ? <View style={styles.topContent}>{topContent}</View> : null}

        <View style={styles.logsBody}>
          {isLoading ? (
            <View style={styles.logsCenter}>
              <ActivityIndicator />
              <Text style={styles.logsHint}>Lade Logs…</Text>
            </View>
          ) : error ? (
            <View style={styles.logsCenter}>
              <Text style={styles.logsErrorTitle}>Fehler</Text>
              <Text style={styles.logsErrorText}>{sanitizeUiText(error)}</Text>
            </View>
          ) : logEntries.length === 0 ? (
            <View style={styles.logsCenter}>
              <Text style={styles.logsHint}>Noch keine Logs verfügbar.</Text>
            </View>
          ) : (
            <ScrollView
              ref={(r) => {
                scrollRef.current = r;
              }}
              style={styles.logsScroll}
              contentContainerStyle={styles.logsScrollContent}
            >
              {logEntries.map((entry) => (
                <Text
                  key={entry.id}
                  selectable
                  style={[styles.logLine, entry.isError && styles.errorLine]}
                >
                  {entry.line}
                </Text>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

