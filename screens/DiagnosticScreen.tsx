import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../theme";
import { useProject } from "../contexts/ProjectContext";
import type { ProjectFile } from "../contexts/types";

import { validateFileContent, validateFilePath } from "../lib/validators";

import type {
  PreflightCheckResult,
  PreflightPatch,
  PreflightTarget,
} from "../lib/diagnostics/preflightTypes";
import { runPreflightChecksProgressive } from "../lib/diagnostics/preflightRunner";
import {
  formatDiagnosticUpload,
  uploadDiagnosticToSupabase,
} from "../lib/diagnostics/diagnosticUploader";
import {
  sanitizeDiagnosticUpload,
  safeTruncateText,
} from "../lib/diagnostics/sanitize";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * Diagnostics Screen (v8.10)
 * - Cleaner, more "pro" UI
 * - Per-result Fix button
 * - AutoFix with a nice progress modal
 *
 * NOTE: This file is intentionally self-contained (no new deps).
 */

type Status = "pass" | "warn" | "fail";
type FixStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

const ORDER: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };
const MAX_HISTORY = 10;
const DEVICE_ID_KEY = "k1w1_device_id";
const UPLOAD_COOLDOWN_MS = 30_000;
const UPLOAD_RETRY_DELAY_MS = 3_000;
const UPLOAD_COOLDOWN_KEY = "k1w1_upload_cooldown_until";

const MAX_DETAILS = 10;
const AUTOFIX_MAX = 50; // safety: don't apply endless chains
const FIX_MODAL_MAX_LINES = 7;

function getStatusColor(s: Status): string {
  if (s === "fail") return theme.palette.error;
  if (s === "warn") return theme.palette.warning;
  return theme.palette.success;
}

function getStatusIcon(s: Status) {
  if (s === "fail") return "close-circle";
  if (s === "warn") return "warning";
  return "checkmark-circle";
}

type FixHistoryEntry = {
  label: string;
  at: number;
  snapshot: ProjectFile[];
  createdPaths: string[];
};

type FixStep = {
  key: string;
  title: string;
  status: FixStepStatus;
  message?: string;
};

function StatusPill({ status }: { status: Status }) {
  const c = getStatusColor(status);
  return (
    <View
      style={[
        styles.statusPill,
        { borderColor: c, backgroundColor: "rgba(0,0,0,0.25)" },
      ]}
    >
      <Ionicons name={getStatusIcon(status)} size={14} color={c} />
      <Text style={[styles.statusPillText, { color: c }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={styles.progressOuter}>
      <View
        style={[
          styles.progressInner,
          { width: `${Math.round(clamped * 100)}%` },
        ]}
      />
    </View>
  );
}

function FixRunModal(props: {
  visible: boolean;
  title: string;
  subtitle?: string;
  steps: FixStep[];
  currentIndex: number;
  done: boolean;
  onClose: () => void;
}) {
  const { visible, title, subtitle, steps, currentIndex, done, onClose } =
    props;

  const pct = steps.length ? currentIndex / steps.length : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons
                name={done ? "sparkles" : "construct"}
                size={18}
                color={theme.palette.primaryLight}
              />
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <TouchableOpacity
              style={[styles.iconBtn, !done && { opacity: 0.5 }]}
              onPress={onClose}
              disabled={!done}
              accessibilityLabel="Close"
            >
              <Ionicons
                name="close"
                size={18}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>
          </View>

          {subtitle ? (
            <Text style={styles.modalSubtitle}>{subtitle}</Text>
          ) : null}

          <View style={{ marginTop: 12 }}>
            <ProgressBar pct={pct} />
            <Text style={styles.modalHint}>
              {done
                ? "Fertig. Du kannst schließen."
                : "Bitte nicht schließen – Fixes laufen…"}
            </Text>
          </View>

          <View style={{ marginTop: 12 }}>
            {steps.slice(0, FIX_MODAL_MAX_LINES).map((s, idx) => {
              const isActive = idx === currentIndex && !done;
              const icon =
                s.status === "done"
                  ? "checkmark-circle"
                  : s.status === "failed"
                    ? "close-circle"
                    : s.status === "running"
                      ? "time"
                      : s.status === "skipped"
                        ? "remove-circle"
                        : "ellipse-outline";

              const color =
                s.status === "done"
                  ? theme.palette.success
                  : s.status === "failed"
                    ? theme.palette.error
                    : s.status === "running"
                      ? theme.palette.info
                      : theme.palette.text.muted;

              return (
                <View
                  key={s.key}
                  style={[styles.stepRow, isActive && styles.stepRowActive]}
                >
                  <Ionicons name={icon as any} size={16} color={color} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.stepTitle,
                        isActive && { color: theme.palette.text.primary },
                      ]}
                    >
                      {s.title}
                    </Text>
                    {s.message ? (
                      <Text style={styles.stepMsg}>{s.message}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {steps.length > FIX_MODAL_MAX_LINES ? (
              <Text style={styles.moreText}>
                … und {steps.length - FIX_MODAL_MAX_LINES} weitere
              </Text>
            ) : null}
          </View>

          {!done ? (
            <View style={styles.modalFooter}>
              <ActivityIndicator />
              <Text style={styles.modalFooterText}>AutoFix arbeitet…</Text>
            </View>
          ) : (
            <View style={styles.modalFooter}>
              <Ionicons
                name="checkmark"
                size={16}
                color={theme.palette.success}
              />
              <Text style={styles.modalFooterText}>Fertig.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function DiagnosticScreen() {
  const { projectData, updateProjectFiles, deleteFile } = useProject();

  const projectRef = useRef(projectData);
  useEffect(() => {
    projectRef.current = projectData;
  }, [projectData]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Restore upload cooldown (UX-only) across app restarts.

  // Tick cooldown UI and auto-clear when it expires.

  const [target, setTarget] = useState<PreflightTarget>({ mode: "expoGo" });
  const [results, setResults] = useState<PreflightCheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const [progressStage, setProgressStage] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const [history, setHistory] = useState<FixHistoryEntry[]>([]);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLabel, setPreviewLabel] = useState("");
  const [previewEntries, setPreviewEntries] = useState<
    Array<{ path: string; oldText: string | null; newText: string | null }>
  >([]);

  const [applyBusy, setApplyBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const uploadBusyRef = useRef(false);
  const [uploadCooldownUntil, setUploadCooldownUntil] = useState(0);
  const uploadClientRequestIdRef = useRef<string | null>(null);
  const uploadClientRequestIdExpiresAtRef = useRef<number>(0);

  // Cache client_request_id for a short window so retries are idempotent.
  // After TTL or after a successful upload we generate a fresh one.
  const getOrCreateUploadClientRequestId = useCallback((): string => {
    const now = Date.now();
    const cur = uploadClientRequestIdRef.current;
    const exp = uploadClientRequestIdExpiresAtRef.current;
    if (cur && exp && now < exp) return cur;
    const next = uuidv4();
    uploadClientRequestIdRef.current = next;
    uploadClientRequestIdExpiresAtRef.current = now + 30_000; // 30s window
    return next;
  }, []);

  const resetUploadClientRequestId = useCallback(() => {
    uploadClientRequestIdRef.current = null;
    uploadClientRequestIdExpiresAtRef.current = 0;
  }, []);

  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const uploadCooldownLeftSec = useMemo(() => {
    if (!uploadCooldownUntil) return 0;
    const left = uploadCooldownUntil - cooldownNow;
    return left > 0 ? Math.ceil(left / 1000) : 0;
  }, [uploadCooldownUntil, cooldownNow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(UPLOAD_COOLDOWN_KEY);
        if (!raw) return;
        const until = Number(raw);
        if (!Number.isFinite(until) || until <= 0) {
          await AsyncStorage.removeItem(UPLOAD_COOLDOWN_KEY);
          return;
        }
        const now = Date.now();
        if (until <= now) {
          await AsyncStorage.removeItem(UPLOAD_COOLDOWN_KEY);
          return;
        }
        if (cancelled) return;
        setUploadCooldownUntil(until);
        setCooldownNow(now);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uploadCooldownUntil) return;
    const tick = () => {
      const now = Date.now();
      if (!mountedRef.current) return;
      setCooldownNow(now);
      if (uploadCooldownUntil <= now) {
        setUploadCooldownUntil(0);
        AsyncStorage.removeItem(UPLOAD_COOLDOWN_KEY).catch(() => {});
      }
    };
    tick();
    if (uploadCooldownUntil <= Date.now()) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [uploadCooldownUntil]);

  const applyBusyRef = useRef(false);

  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [fixModalTitle, setFixModalTitle] = useState("AutoFix");
  const [fixModalSubtitle, setFixModalSubtitle] = useState<string | undefined>(
    undefined,
  );
  const [fixSteps, setFixSteps] = useState<FixStep[]>([]);
  const [fixStepIndex, setFixStepIndex] = useState(0);
  const [fixDone, setFixDone] = useState(false);

  // Filters
  const [filter, setFilter] = useState<"all" | Status>("all");

  const counts = useMemo(() => {
    const c = { pass: 0, warn: 0, fail: 0 };
    for (const r of results) {
      const st = (r.status ?? "pass") as Status;
      c[st] += 1;
    }
    return c;
  }, [results]);

  const sortedResults = useMemo(() => {
    const list = [...results];
    list.sort(
      (a, b) =>
        ORDER[(a.status as Status) ?? "pass"] -
        ORDER[(b.status as Status) ?? "pass"],
    );
    return list;
  }, [results]);

  const visibleResults = useMemo(() => {
    if (filter === "all") return sortedResults;
    return sortedResults.filter((r) => (r.status as Status) === filter);
  }, [filter, sortedResults]);

  const fixableResults = useMemo(() => {
    const list = sortedResults.filter((r) => !!r.fix?.patch);
    // deterministic order: fails first, then warns
    list.sort(
      (a, b) =>
        ORDER[(a.status as Status) ?? "pass"] -
        ORDER[(b.status as Status) ?? "pass"],
    );
    return list;
  }, [sortedResults]);

  const closeFixModal = useCallback(() => {
    if (!fixDone) return; // only closable when done
    setFixModalVisible(false);
  }, [fixDone]);

  const run = useCallback(async () => {
    if (!projectRef.current) {
      Alert.alert("Kein Projekt", "Bitte zuerst ein Projekt laden.");
      return;
    }
    if (runningRef.current) return;

    runningRef.current = true;
    setRunning(true);
    setResults([]);
    setSelected({});
    setHistory([]);
    setProgressStage("Checks starten…");

    try {
      const files = projectRef.current.files;
      const prog = runPreflightChecksProgressive(files, target);
      const all: PreflightCheckResult[] = [];
      // progressive generator yields batches
      for await (const stage of prog as any) {
        if (stage?.priority)
          setProgressStage(`Checks: ${String(stage.priority)}`);
        if (stage?.results?.length) {
          all.push(...stage.results);
          if (mountedRef.current) setResults([...all]);
        }
      }
      if (mountedRef.current) {
        setResults(all);
        setProgressStage(null);
      }
    } catch (e: any) {
      Alert.alert(
        "Diagnostics fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
      if (mountedRef.current) setProgressStage(null);
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setRunning(false);
    }
  }, [target]);

  const openPreview = useCallback(
    async (label: string, patch: PreflightPatch) => {
      if (!projectRef.current) return;
      const filesMap = new Map(
        projectRef.current.files.map((f) => [f.path, f.content]),
      );
      const entries: Array<{
        path: string;
        oldText: string | null;
        newText: string | null;
      }> = [];

      const upsert = patch.upsert ?? [];
      for (const u of upsert) {
        entries.push({
          path: u.path,
          oldText: filesMap.has(u.path)
            ? (filesMap.get(u.path) as string)
            : null,
          newText: u.content ?? "",
        });
      }
      const del = patch.delete ?? [];
      for (const p of del) {
        entries.push({
          path: p,
          oldText: filesMap.has(p) ? (filesMap.get(p) as string) : null,
          newText: null,
        });
      }
      // jsonMerge is handled inside smartPatch on apply; we preview as "changed" placeholder
      const jm = patch.jsonMerge ?? [];
      for (const j of jm) {
        entries.push({
          path: j.path,
          oldText: filesMap.has(j.path)
            ? (filesMap.get(j.path) as string)
            : null,
          newText:
            "• JSON merge patch (Preview zeigt nur vorher – nachher wird beim Apply erzeugt)",
        });
      }

      setPreviewLabel(label);
      setPreviewEntries(entries);
      setPreviewVisible(true);
    },
    [],
  );

  const applyPatch = useCallback(
    async (label: string, patch: PreflightPatch) => {
      if (!projectRef.current) throw new Error("Kein Projekt geladen.");
      if (applyBusyRef.current) return;

      applyBusyRef.current = true;
      if (mountedRef.current) setApplyBusy(true);

      const currentFiles = projectRef.current.files;
      try {
        // Validate & normalize touched paths for snapshot
        const touchedPaths = Array.from(
          new Set<string>([
            ...(patch.upsert ?? []).map((u) => u.path),
            ...(patch.delete ?? []).map((p) => p),
            ...(patch.jsonMerge ?? []).map((j) => j.path),
          ]),
        );

        const normalizedTouched = touchedPaths
          .map((p) => {
            const v = validateFilePath(p);
            if (!v.valid || !v.normalized)
              throw new Error(
                `Ungültiger Pfad im Patch: ${p} (${v.errors.join(", ") || "invalid"})`,
              );
            return v.normalized;
          })
          .sort();

        const currentMap = new Map(
          currentFiles.map((f) => [f.path, f] as const),
        );
        const snapshot: ProjectFile[] = [];
        const createdPaths: string[] = [];
        for (const p of normalizedTouched) {
          const prev = currentMap.get(p);
          if (prev) snapshot.push(prev);
          else createdPaths.push(p);
        }

        const nextMap = new Map(
          currentFiles.map((f) => [f.path, f.content] as const),
        );

        // upserts
        for (const u of patch.upsert ?? []) {
          const pv = validateFilePath(u.path);
          if (!pv.valid || !pv.normalized)
            throw new Error(
              `Ungültiger Pfad im Patch: ${u.path} (${pv.errors.join(", ") || "invalid"})`,
            );
          const cv = validateFileContent(u.content ?? "");
          if (!cv.valid)
            throw new Error(
              `Ungültiger File-Content für ${u.path}: ${cv.error ?? "unknown"}`,
            );
          nextMap.set(pv.normalized, u.content ?? "");
        }

        // deletes
        for (const p of patch.delete ?? []) {
          const pv = validateFilePath(p);
          if (!pv.valid || !pv.normalized)
            throw new Error(
              `Ungültiger Pfad im Patch: ${p} (${pv.errors.join(", ") || "invalid"})`,
            );
          nextMap.delete(pv.normalized);
        }

        // jsonMerge
        if (patch.jsonMerge?.length) {
          // Defer to smartPatch helper if available in your project.
          // We keep this robust: only attempt if file exists and content is valid JSON.
          const { applyJsonMergePatchSafe } =
            await import("../lib/diagnostics/smartPatch");
          const merged = await applyJsonMergePatchSafe(
            Array.from(nextMap.entries()).map(([path, content]) => ({
              path,
              content,
            })),
            patch.jsonMerge,
          );
          nextMap.clear();
          for (const f of merged) nextMap.set(f.path, f.content);
        }

        const nextFiles: ProjectFile[] = Array.from(nextMap.entries()).map(
          ([path, content]) => ({ path, content }),
        );

        // Apply deletions through context if deleteFile exists (keeps storage consistent),
        // otherwise rely on updateProjectFiles result.
        try {
          // If deleteFile is supported, call it for the deletes.
          for (const p of patch.delete ?? []) {
            const pv = validateFilePath(p);
            if (pv.valid && pv.normalized) await deleteFile(pv.normalized);
          }
        } catch {
          // ignore – updateProjectFiles will still update in-memory state
        }

        await updateProjectFiles(nextFiles);

        // Track history (undo only needs touched + created)
        setHistory((prev) => {
          const entry: FixHistoryEntry = {
            label,
            at: Date.now(),
            snapshot,
            createdPaths,
          };
          return [entry, ...prev].slice(0, MAX_HISTORY);
        });
      } finally {
        applyBusyRef.current = false;
        if (mountedRef.current) setApplyBusy(false);
      }
    },
    [deleteFile, updateProjectFiles],
  );

  const undoLast = useCallback(async () => {
    const last = history[0];
    if (!last) return;

    if (applyBusyRef.current) return;
    applyBusyRef.current = true;
    if (mountedRef.current) setApplyBusy(true);

    try {
      // delete created files first
      for (const p of last.createdPaths ?? []) {
        await deleteFile(p);
      }
      // restore touched snapshot
      if (last.snapshot.length) {
        await updateProjectFiles(last.snapshot);
      }
      setHistory((prev) => prev.slice(1));
    } catch (e: any) {
      Alert.alert("Undo fehlgeschlagen", e?.message || "Unbekannter Fehler");
    } finally {
      applyBusyRef.current = false;
      if (mountedRef.current) setApplyBusy(false);
    }
  }, [deleteFile, history, updateProjectFiles]);

  const undoAll = useCallback(async () => {
    if (!history.length) return;

    Alert.alert(
      "Alle Fixes rückgängig machen?",
      `${history.length} Fix(es) werden zurückgesetzt.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Undo All",
          style: "destructive",
          onPress: async () => {
            // Undo newest → oldest (history is newest-first)
            let undone = 0;
            for (const entry of history) {
              try {
                for (const p of entry.createdPaths ?? []) {
                  await deleteFile(p);
                }
                if (entry.snapshot.length) {
                  await updateProjectFiles(entry.snapshot);
                }
                undone++;
              } catch (e: any) {
                Alert.alert(
                  "Undo All fehlgeschlagen",
                  `Abgebrochen nach ${undone} Fix(es): ${e?.message || "Unbekannter Fehler"}`,
                );
                break;
              }
            }
            if (mountedRef.current && undone > 0) {
              setHistory((prev) => prev.slice(undone));
              Alert.alert("✓ Undo", `${undone} Fix(es) rückgängig gemacht.`);
            }
          },
        },
      ],
    );
  }, [history, deleteFile, updateProjectFiles]);

  const toggleSelected = useCallback((key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const clearSelection = useCallback(() => setSelected({}), []);

  const selectFails = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const r of sortedResults) {
      const st = (r.status ?? "pass") as Status;
      if (st === "fail" && r.fix?.patch) next[r.id] = true;
    }
    setSelected(next);
  }, [sortedResults]);

  const applySelected = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

    const chosen = sortedResults.filter((r) => selected[r.id] && r.fix?.patch);
    if (!chosen.length) {
      Alert.alert("Nichts ausgewählt", "Bitte wähle Fixes aus.");
      return;
    }

    const steps = chosen.slice(0, AUTOFIX_MAX).map((r) => ({
      key: r.id,
      title: r.title,
      status: "pending" as FixStepStatus,
    }));

    setFixModalTitle("Fix Selected");
    setFixModalSubtitle(`${steps.length} Fix(es) werden angewendet…`);
    setFixSteps(steps);
    setFixStepIndex(0);
    setFixDone(false);
    setFixModalVisible(true);

    for (let i = 0; i < steps.length; i++) {
      if (!mountedRef.current) break;
      setFixStepIndex(i);
      setFixSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s)),
      );

      try {
        const r = chosen[i];
        await applyPatch(r.title, r.fix!.patch);
        setFixSteps((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "done" } : s)),
        );
      } catch (e: any) {
        setFixSteps((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  status: "failed",
                  message: safeTruncateText(e?.message || "Fehler", 160),
                }
              : s,
          ),
        );
        // Stop on first error to avoid cascading inconsistencies between fixes.
        break;
      }
    }

    setFixDone(true);
    setFixStepIndex(steps.length);
    setFixModalSubtitle("Fertig – bitte kurz prüfen.");
  }, [applyPatch, selected, sortedResults]);

  const autoFix = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

    const chosen = fixableResults.filter(
      (r) => (r.status as Status) === "fail",
    );
    if (!chosen.length) {
      Alert.alert("Nichts zu fixen", "Keine fail-Fixes gefunden.");
      return;
    }

    Alert.alert(
      "AutoFix starten?",
      `Es werden ${Math.min(chosen.length, AUTOFIX_MAX)} Fix(es) automatisch angewendet.\n\nTipp: Danach einmal „Run“ drücken, um zu prüfen.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "AutoFix",
          onPress: async () => {
            const slice = chosen.slice(0, AUTOFIX_MAX);
            const steps: FixStep[] = slice.map((r) => ({
              key: r.id,
              title: r.title,
              status: "pending",
            }));

            setFixModalTitle("AutoFix");
            setFixModalSubtitle("Fails werden automatisch gefixt…");
            setFixSteps(steps);
            setFixStepIndex(0);
            setFixDone(false);
            setFixModalVisible(true);

            for (let i = 0; i < steps.length; i++) {
              if (!mountedRef.current) break;
              setFixStepIndex(i);
              setFixSteps((prev) =>
                prev.map((s, idx) =>
                  idx === i ? { ...s, status: "running" } : s,
                ),
              );

              try {
                const r = slice[i];
                await applyPatch(r.title, r.fix!.patch);
                setFixSteps((prev) =>
                  prev.map((s, idx) =>
                    idx === i ? { ...s, status: "done" } : s,
                  ),
                );
              } catch (e: any) {
                setFixSteps((prev) =>
                  prev.map((s, idx) =>
                    idx === i
                      ? {
                          ...s,
                          status: "failed",
                          message: safeTruncateText(
                            e?.message || "Fehler",
                            160,
                          ),
                        }
                      : s,
                  ),
                );
                break;
              }
            }

            setFixDone(true);
            setFixStepIndex(steps.length);
            setFixModalSubtitle("Fertig – einmal kurz nachschauen.");
          },
        },
      ],
    );
  }, [applyPatch, fixableResults]);

  const applySingle = useCallback(
    (r: PreflightCheckResult) => {
      if (!r.fix?.patch) return;
      Alert.alert(
        "Fix anwenden?",
        `${r.title}\n\n${safeTruncateText(r.message ?? "", 240)}`,
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Preview",
            onPress: () => openPreview(r.title, r.fix!.patch),
          },
          {
            text: "Fix",
            onPress: async () => {
              try {
                await applyPatch(r.title, r.fix!.patch);
                Alert.alert("✓ Fix angewendet", r.title);
              } catch (e: any) {
                Alert.alert(
                  "Fix fehlgeschlagen",
                  e?.message || "Unbekannter Fehler",
                );
              }
            },
          },
        ],
      );
    },
    [applyPatch, openPreview],
  );

  const getOrCreateDeviceId = useCallback(async (): Promise<string> => {
    try {
      const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (existing) return existing;
    } catch {
      // ignore
    }
    let rand = "";
    try {
      const bytes = await Crypto.getRandomBytesAsync(16);
      rand = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      rand = Math.random().toString(16).slice(2);
    }
    const id = `dev_${rand}`;
    try {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    } catch {
      // ignore
    }
    return id;
  }, []);

  const upload = useCallback(async () => {
    const project = projectRef.current;
    if (!project) return;
    if (uploadBusyRef.current) return;

    if (uploadCooldownLeftSec > 0) {
      Alert.alert("■ Cooldown", `Bitte warte noch ${uploadCooldownLeftSec}s.`);
      return;
    }
    if (!results.length) {
      Alert.alert("Kein Report", "Erst „Run“ ausführen, dann Upload.");
      return;
    }

    uploadBusyRef.current = true;
    if (mountedRef.current) setUploadBusy(true);
    try {
      const deviceId = await getOrCreateDeviceId();
      const payload = sanitizeDiagnosticUpload(
        formatDiagnosticUpload({
          clientRequestId: getOrCreateUploadClientRequestId(),
          deviceId,
          projectName: project.name,
          target,
          results,
          files: project.files,
        }),
      );

      const id = await uploadDiagnosticToSupabase(payload);
      if (!id) throw new Error("Upload fehlgeschlagen");

      if (mountedRef.current) {
        const until = Date.now() + UPLOAD_COOLDOWN_MS;
        setUploadCooldownUntil(until);
        setCooldownNow(Date.now());
        AsyncStorage.setItem(UPLOAD_COOLDOWN_KEY, String(until)).catch(
          () => {},
        );
      }

      Alert.alert("■ Upload OK", `ID: ${id.id}`);
    } catch (e: any) {
      if (mountedRef.current) {
        const until = Date.now() + UPLOAD_RETRY_DELAY_MS;
        setUploadCooldownUntil(until);
        setCooldownNow(Date.now());
        AsyncStorage.setItem(UPLOAD_COOLDOWN_KEY, String(until)).catch(
          () => {},
        );
      }
      Alert.alert("Upload fehlgeschlagen", e?.message || "Unbekannter Fehler");
    } finally {
      uploadBusyRef.current = false;
      if (mountedRef.current) setUploadBusy(false);
    }
  }, [getOrCreateDeviceId, results, target, uploadCooldownLeftSec]);

  const copyReport = useCallback(async () => {
    const project = projectRef.current;
    if (!project) return;
    if (!results.length) {
      Alert.alert("Kein Report", "Erst „Run“ ausführen, dann kopieren.");
      return;
    }
    try {
      const deviceId = await getOrCreateDeviceId();
      const payload = sanitizeDiagnosticUpload(
        formatDiagnosticUpload({
          clientRequestId: getOrCreateUploadClientRequestId(),
          deviceId,
          projectName: project.name,
          target,
          results,
          files: project.files,
        }),
      );
      const json = JSON.stringify(payload, null, 2);
      await Clipboard.setStringAsync(safeTruncateText(json, 80_000));
      Alert.alert("✓ Kopiert", "Report wurde in die Zwischenablage kopiert.");
    } catch (e: any) {
      Alert.alert(
        "Kopieren fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
    }
  }, [getOrCreateDeviceId, results, target]);

  const headerStats = useMemo(() => {
    const name = projectRef.current?.name ?? "–";
    const mode =
      target.mode === "expoGo" ? "Expo Go" : `EAS: ${target.profile ?? "?"}`;
    return { name, mode };
  }, [target]);

  const renderItem = useCallback(
    ({ item }: { item: PreflightCheckResult }) => {
      const st = (item.status ?? "pass") as Status;
      const hasFix = !!item.fix?.patch;

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <StatusPill status={st} />
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>

          {item.message ? (
            <Text style={styles.cardMsg} numberOfLines={4}>
              {item.message}
            </Text>
          ) : null}

          {item.details?.length ? (
            <View style={styles.detailsBox}>
              {item.details.slice(0, MAX_DETAILS).map((d, i) => (
                <Text key={`${item.id}_${i}`} style={styles.detailLine}>
                  • {safeTruncateText(d, 180)}
                </Text>
              ))}
              {item.details.length > MAX_DETAILS ? (
                <Text style={styles.moreText}>
                  … +{item.details.length - MAX_DETAILS} weitere
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.cardActions}>
            {hasFix ? (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={() => applySingle(item)}
                  disabled={running || applyBusy}
                >
                  <Ionicons
                    name="flash"
                    size={16}
                    color={theme.palette.text.primary}
                  />
                  <Text style={styles.actionBtnText}>Fix</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openPreview(item.title, item.fix!.patch)}
                  disabled={running || applyBusy}
                >
                  <Ionicons
                    name="eye"
                    size={16}
                    color={theme.palette.text.primary}
                  />
                  <Text style={styles.actionBtnText}>Preview</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.checkboxBtn,
                    selected[item.id] && styles.checkboxOn,
                  ]}
                  onPress={() => toggleSelected(item.id)}
                  disabled={running || applyBusy}
                >
                  <Ionicons
                    name={selected[item.id] ? "checkbox" : "square-outline"}
                    size={18}
                    color={
                      selected[item.id]
                        ? theme.palette.success
                        : theme.palette.text.muted
                    }
                  />
                  <Text style={styles.actionBtnText}>Select</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Text style={styles.noFixText}>Kein Fix verfügbar</Text>
              </View>
            )}
          </View>
        </View>
      );
    },
    [applyBusy, applySingle, openPreview, running, selected, toggleSelected],
  );

  if (!projectData) {
    return (
      <View style={styles.center}>
        <Text style={styles.h1}>Diagnostics</Text>
        <Text style={styles.muted}>Bitte ein Projekt laden.</Text>
      </View>
    );
  }

  const busy = running || applyBusy;

  return (
    <View style={styles.container}>
      <FixRunModal
        visible={fixModalVisible}
        title={fixModalTitle}
        subtitle={fixModalSubtitle}
        steps={fixSteps}
        currentIndex={fixStepIndex}
        done={fixDone}
        onClose={closeFixModal}
      />

      {/* Preview Modal */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewWrap}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {previewLabel}
            </Text>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setPreviewVisible(false)}
            >
              <Ionicons
                name="close"
                size={18}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }}>
            {previewEntries.map((e) => (
              <View key={e.path} style={styles.previewCard}>
                <Text style={styles.previewPath}>{e.path}</Text>

                <Text style={styles.previewLabel}>Before</Text>
                <Text style={styles.previewText} selectable>
                  {safeTruncateText(e.oldText ?? "", 6000)}
                </Text>

                <Text style={styles.previewLabel}>After</Text>
                <Text style={styles.previewText} selectable>
                  {safeTruncateText(e.newText ?? "", 6000)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Diagnostics</Text>
            <Text style={styles.sub}>
              {headerStats.name} • {headerStats.mode}
            </Text>
          </View>
          {busy ? (
            <View style={styles.busyChip}>
              <ActivityIndicator size="small" />
              <Text style={styles.busyText}>
                {running ? "Running…" : "Applying…"}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.stat, { borderColor: theme.palette.success }]}>
            <Text style={styles.statN}>{counts.pass}</Text>
            <Text style={styles.statL}>Pass</Text>
          </View>
          <View style={[styles.stat, { borderColor: theme.palette.warning }]}>
            <Text style={styles.statN}>{counts.warn}</Text>
            <Text style={styles.statL}>Warn</Text>
          </View>
          <View style={[styles.stat, { borderColor: theme.palette.error }]}>
            <Text style={styles.statN}>{counts.fail}</Text>
            <Text style={styles.statL}>Fail</Text>
          </View>
        </View>

        {progressStage ? (
          <Text style={styles.progressText}>{progressStage}</Text>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.bigBtn, styles.bigBtnGhost]}
            onPress={run}
            disabled={busy}
          >
            <Ionicons
              name="play"
              size={18}
              color={theme.palette.text.primary}
            />
            <Text style={styles.bigBtnText}>Run</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bigBtn, styles.bigBtnPrimary]}
            onPress={autoFix}
            disabled={busy || counts.fail === 0}
          >
            <Ionicons
              name="sparkles"
              size={18}
              color={theme.palette.text.primary}
            />
            <Text style={styles.bigBtnText}>AutoFix</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bigBtn,
              styles.bigBtnGhost,
              (busy ||
                uploadBusy ||
                uploadCooldownLeftSec > 0 ||
                !results.length) && { opacity: 0.5 },
            ]}
            onPress={upload}
            disabled={
              busy || uploadBusy || uploadCooldownLeftSec > 0 || !results.length
            }
          >
            <Ionicons
              name="cloud-upload"
              size={20}
              color={theme.palette.text.primary}
            />
            <Text style={styles.bigBtnText}>
              {uploadBusy
                ? "Uploading…"
                : uploadCooldownLeftSec > 0
                  ? `Upload (${uploadCooldownLeftSec}s)`
                  : "Upload"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bigBtn,
              styles.bigBtnGhost,
              (busy || !results.length) && { opacity: 0.5 },
            ]}
            onPress={copyReport}
            disabled={busy || !results.length}
          >
            <Ionicons
              name="copy"
              size={20}
              color={theme.palette.text.primary}
            />
            <Text style={styles.bigBtnText}>Copy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow2}>
          <TouchableOpacity
            style={[styles.smallBtn, selectedCount === 0 && styles.btnDisabled]}
            onPress={applySelected}
            disabled={busy || selectedCount === 0}
          >
            <Ionicons
              name="flash"
              size={16}
              color={theme.palette.text.primary}
            />
            <Text style={styles.smallBtnText}>
              Fix Selected ({selectedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.smallBtn,
              history.length === 0 && styles.btnDisabled,
            ]}
            onPress={undoLast}
            disabled={busy || history.length === 0}
          >
            <Ionicons
              name="return-down-back"
              size={16}
              color={theme.palette.text.primary}
            />
            <Text style={styles.smallBtnText}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallBtn, history.length < 2 && styles.btnDisabled]}
            onPress={undoAll}
            disabled={busy || history.length < 2}
          >
            <Ionicons
              name="repeat"
              size={16}
              color={theme.palette.text.primary}
            />
            <Text style={styles.smallBtnText}>Undo All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallBtn]}
            onPress={selectFails}
            disabled={busy || counts.fail === 0}
          >
            <Ionicons
              name="alert-circle"
              size={16}
              color={theme.palette.text.primary}
            />
            <Text style={styles.smallBtnText}>Select fails</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallBtn}
            onPress={clearSelection}
            disabled={busy || selectedCount === 0}
          >
            <Ionicons
              name="close"
              size={16}
              color={theme.palette.text.primary}
            />
            <Text style={styles.smallBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {(["all", "fail", "warn", "pass"] as const).map((k) => {
            const on = filter === k;
            const label =
              k === "all"
                ? `All (${results.length})`
                : k === "fail"
                  ? `Fail (${counts.fail})`
                  : k === "warn"
                    ? `Warn (${counts.warn})`
                    : `Pass (${counts.pass})`;
            return (
              <TouchableOpacity
                key={k}
                style={[styles.filterPill, on && styles.filterPillOn]}
                onPress={() => setFilter(k as any)}
                disabled={busy}
              >
                <Text
                  style={[
                    styles.filterText,
                    on && { color: theme.palette.text.primary },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={visibleResults}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: 14,
          paddingBottom: Platform.OS === "ios" ? 40 : 24,
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Noch kein Report</Text>
            <Text style={styles.muted}>
              Drück „Run“, dann siehst du hier die Checks.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: theme.palette.background,
  },
  h1: { fontSize: 22, fontWeight: "800", color: theme.palette.text.primary },
  sub: { marginTop: 2, color: theme.palette.text.muted },
  muted: { color: theme.palette.text.muted, marginTop: 8, textAlign: "center" },

  hero: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  busyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.card,
  },
  busyText: { color: theme.palette.text.secondary, fontSize: 12 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  stat: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: theme.palette.card,
    alignItems: "center",
  },
  statN: { fontSize: 18, fontWeight: "900", color: theme.palette.text.primary },
  statL: { marginTop: 2, fontSize: 12, color: theme.palette.text.muted },

  progressText: {
    marginTop: 10,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  bigBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
  },
  bigBtnText: { color: theme.palette.text.primary, fontWeight: "800" },
  bigBtnPrimary: {
    borderColor: theme.palette.primaryLight,
    backgroundColor: "rgba(0,255,0,0.10)",
  },
  bigBtnGhost: {
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.card,
  },

  actionsRow2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  btnDisabled: { opacity: 0.45 },

  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.card,
  },
  filterPillOn: {
    borderColor: theme.palette.primaryLight,
    backgroundColor: "rgba(0,255,0,0.08)",
  },
  filterText: {
    color: theme.palette.text.secondary,
    fontWeight: "700",
    fontSize: 12,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: {
    flex: 1,
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  cardMsg: {
    marginTop: 8,
    color: theme.palette.text.secondary,
    lineHeight: 18,
  },

  detailsBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.backgroundDark,
  },
  detailLine: { color: theme.palette.text.secondary, marginBottom: 4 },

  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
    alignItems: "center",
  },
  actionBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtnPrimary: {
    borderColor: theme.palette.primaryLight,
    backgroundColor: "rgba(0,255,0,0.10)",
  },
  actionBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  noFixText: {
    color: theme.palette.text.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  checkboxBtn: { borderColor: theme.palette.borderLight },
  checkboxOn: {
    borderColor: theme.palette.success,
    backgroundColor: "rgba(0,255,0,0.06)",
  },

  statusPill: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 11, fontWeight: "900" },

  empty: { paddingVertical: 30, alignItems: "center" },
  emptyTitle: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 16,
  },

  // Preview
  previewWrap: { flex: 1, backgroundColor: theme.palette.background },
  previewHeader: {
    paddingTop: Platform.OS === "ios" ? 54 : 18,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  previewTitle: {
    flex: 1,
    color: theme.palette.text.primary,
    fontWeight: "900",
  },
  previewCard: {
    margin: 14,
    marginBottom: 0,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  previewPath: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    marginBottom: 8,
  },
  previewLabel: {
    color: theme.palette.text.muted,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  previewText: {
    color: theme.palette.text.secondary,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 12,
    lineHeight: 16,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.backgroundDark,
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  modalSubtitle: { color: theme.palette.text.secondary, marginTop: 6 },
  modalHint: { color: theme.palette.text.muted, marginTop: 8, fontSize: 12 },

  progressOuter: {
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  progressInner: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(0,255,0,0.35)",
  },

  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  stepRowActive: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  stepTitle: { color: theme.palette.text.secondary, fontWeight: "800" },
  stepMsg: { marginTop: 2, color: theme.palette.text.muted, fontSize: 12 },
  moreText: {
    marginTop: 8,
    color: theme.palette.text.muted,
    fontSize: 12,
    textAlign: "center",
  },

  modalFooter: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalFooterText: { color: theme.palette.text.secondary, fontWeight: "700" },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
