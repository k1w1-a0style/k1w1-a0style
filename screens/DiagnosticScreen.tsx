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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { safeTruncate } from "../lib/diagnostics/sanitize";
import { applyJsonMerge, deepMergeSafe } from "../lib/diagnostics/smartPatch";
import { DiffPreview } from "../components/DiffPreview";

type FixHistoryEntry = {
  id: string;
  at: number;
  label: string;
  snapshot: ProjectFile[];
  createdPaths: string[];
  touchedPaths: string[];
};

const DEVICE_ID_KEY = "k1w1_device_id";
const MAX_HISTORY = 10;
const UPLOAD_COOLDOWN_MS = 30_000;
const UPLOAD_RETRY_DELAY_MS = 3_000;
const UPLOAD_COOLDOWN_KEY = "k1w1_upload_cooldown_until";

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  let rand = "";
  try {
    const bytes = await Crypto.getRandomBytesAsync(16);
    rand = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    rand = Math.random().toString(16).slice(2);
  }
  const fresh = `dev_${Date.now()}_${rand}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh);
  return fresh;
}

function statusIcon(status: PreflightCheckResult["status"]) {
  if (status === "pass") return "checkmark-circle";
  if (status === "warn") return "warning";
  return "close-circle";
}

function statusColor(status: PreflightCheckResult["status"]) {
  if (status === "pass") return theme.palette.success;
  if (status === "warn") return theme.palette.warning;
  return theme.palette.error;
}

function countStatuses(results: PreflightCheckResult[]) {
  const c: Record<PreflightCheckResult["status"], number> = {
    pass: 0,
    warn: 0,
    fail: 0,
  };
  for (const r of results) c[r.status] += 1;
  return c;
}

function normalizePath(p: string) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function mergePatches(patches: PreflightPatch[]): PreflightPatch {
  const upsertMap = new Map<string, string>();
  const delSet = new Set<string>();
  const jsonMap = new Map<
    string,
    { patch: unknown; createIfMissing?: boolean }
  >();
  const explain: string[] = [];

  for (const p of patches) {
    for (const d of p.delete ?? []) delSet.add(normalizePath(d));
    for (const u of p.upsert ?? [])
      upsertMap.set(normalizePath(u.path), u.content);
    for (const j of p.jsonMerge ?? []) {
      const key = normalizePath(j.path);
      const prev = jsonMap.get(key);
      const merged = prev ? deepMergeSafe(prev.patch, j.patch) : j.patch;
      jsonMap.set(key, {
        patch: merged,
        createIfMissing: prev?.createIfMissing || j.createIfMissing,
      });
    }
    if (p.explanation) explain.push(p.explanation);
  }

  const upsert = Array.from(upsertMap.entries()).map(([path, content]) => ({
    path,
    content,
  }));
  const jsonMerge = Array.from(jsonMap.entries()).map(([path, v]) => ({
    path,
    patch: v.patch,
    createIfMissing: v.createIfMissing,
  }));
  const del = Array.from(delSet.values());
  const explanation = explain.length ? explain.join(" + ") : undefined;

  return {
    upsert: upsert.length ? upsert : undefined,
    delete: del.length ? del : undefined,
    jsonMerge: jsonMerge.length ? jsonMerge : undefined,
    explanation,
  };
}

type PreviewEntry = {
  path: string;
  kind: "upsert" | "jsonMerge";
  oldText: string | null;
  newText: string;
  note?: string;
};

function buildPreviewEntries(
  files: ProjectFile[],
  patch: PreflightPatch,
): PreviewEntry[] {
  const map = new Map(files.map((f) => [normalizePath(f.path), f.content]));
  const entries: PreviewEntry[] = [];

  for (const u of patch.upsert ?? []) {
    const p = normalizePath(u.path);
    entries.push({
      path: p,
      kind: "upsert",
      oldText: map.get(p) ?? null,
      newText: u.content,
    });
  }

  for (const j of patch.jsonMerge ?? []) {
    const p = normalizePath(j.path);
    const old = map.get(p) ?? null;
    const res = applyJsonMerge(old, j.patch, Boolean(j.createIfMissing));
    if (res.ok) {
      entries.push({
        path: p,
        kind: "jsonMerge",
        oldText: old,
        newText: res.nextText,
      });
    } else {
      entries.push({
        path: p,
        kind: "jsonMerge",
        oldText: old,
        newText: old ?? "",
        note: res.error || "json merge failed",
      });
    }
  }

  // order stable
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

export function DiagnosticScreen() {
  const { projectData, updateProjectFiles, deleteFile } = useProject();

  const [target, setTarget] = useState<PreflightTarget>({ mode: "expoGo" });
  const [running, setRunning] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const [results, setResults] = useState<PreflightCheckResult[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<FixHistoryEntry[]>([]);
  const [applyBusy, setApplyBusy] = useState(false);

  const [autoFixBusy, setAutoFixBusy] = useState(false);
  const [autoFixStage, setAutoFixStage] = useState("");
  const [autoFixTotal, setAutoFixTotal] = useState(0);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadCooldownUntil, setUploadCooldownUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());

  // Restore persisted cooldown (best-effort). This is UX-only; DB rate limit is the real protection.
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

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewPatch, setPreviewPatch] = useState<PreflightPatch | null>(null);

  const runningRef = useRef(false);
  const uploadBusyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const uploadCooldownLeftSec = useMemo(() => {
    const leftMs = uploadCooldownUntil - cooldownNow;
    return leftMs > 0 ? Math.ceil(leftMs / 1000) : 0;
  }, [cooldownNow, uploadCooldownUntil]);

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

    // run once immediately so UI updates without waiting 1s
    tick();

    if (uploadCooldownUntil <= Date.now()) return;

    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [uploadCooldownUntil]);

  const files: ProjectFile[] = projectData?.files ?? [];

  const counts = useMemo(() => countStatuses(results), [results]);

  const selectableFixes = useMemo(() => {
    return results.filter((r) => r.status !== "pass" && r.fix?.patch);
  }, [results]);

  const autoFixAvailable = selectableFixes.length > 0;

  const selectedCount = selected.size;

  const run = useCallback(async () => {
    if (!projectData) {
      Alert.alert("Kein Projekt", "Öffne oder importiere zuerst ein Projekt.");
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;

    setRunning(true);
    setResults([]);
    setSelected(new Set());
    setProgressStage("Start…");

    try {
      const all: PreflightCheckResult[] = [];
      for await (const update of runPreflightChecksProgressive(
        projectData.files,
        target,
      )) {
        setProgressStage(`Checks: ${update.stage}`);
        all.push(...update.results);
        setResults([...all]);
      }
    } catch (e: any) {
      Alert.alert("Diagnostics Fehler", e?.message || "Unbekannter Fehler");
    } finally {
      if (mountedRef.current) setRunning(false);
      runningRef.current = false;
      setTimeout(() => setProgressStage(""), 700);
    }
  }, [projectData, target]);

  const openFixPreview = useCallback((title: string, patch: PreflightPatch) => {
    setPreviewTitle(title);
    setPreviewPatch(patch);
    setPreviewOpen(true);
  }, []);

  const applyPatch = useCallback(
    async (label: string, patch: PreflightPatch) => {
      if (!projectData) return;
      if (applyBusy) return;
      setApplyBusy(true);

      // Snapshot only touched paths (keeps memory small)
      const touchedPaths = Array.from(
        new Set([
          ...(patch.upsert ?? []).map((u) => u.path),
          ...(patch.delete ?? []).map((d) => d),
          ...(patch.jsonMerge ?? []).map((j) => j.path),
        ]),
      );

      // Validate & normalize touched paths
      const normalizedTouched = touchedPaths.map((p) => {
        const v = validateFilePath(p);
        if (!v.valid || !v.normalized) {
          throw new Error(
            `Ungültiger Pfad im Patch: ${p} (${v.errors.join(", ")})`,
          );
        }
        return v.normalized;
      });

      const currentMap = new Map(
        projectData.files.map((f) => [normalizePath(f.path), { ...f }]),
      );

      const snapshot: ProjectFile[] = [];
      const createdPaths: string[] = [];
      for (const p of normalizedTouched) {
        const prev = currentMap.get(p);
        if (prev) snapshot.push(prev);
        else createdPaths.push(p);
      }

      const restore = async () => {
        // Remove only files that were created by this patch, then restore previous versions of touched files.
        for (const p of createdPaths) {
          await deleteFile(p);
        }
        if (snapshot.length) {
          await updateProjectFiles(snapshot);
        }
      };

      try {
        // deletes first
        for (const pRaw of patch.delete ?? []) {
          const v = validateFilePath(pRaw);
          if (!v.valid || !v.normalized)
            throw new Error(
              `Ungültiger Delete-Pfad: ${pRaw} (${v.errors.join(", ")})`,
            );
          await deleteFile(v.normalized);
        }

        // compute jsonMerge upserts based on snapshot (predictable)
        const snapMap = new Map(
          snapshot.map((f) => [normalizePath(f.path), f.content]),
        );
        for (const dRaw of patch.delete ?? []) {
          const v = validateFilePath(dRaw);
          if (v.valid && v.normalized)
            snapMap.delete(normalizePath(v.normalized));
        }

        const mergeUpserts: Array<{ path: string; content: string }> = [];
        for (const j of patch.jsonMerge ?? []) {
          const v = validateFilePath(j.path);
          if (!v.valid || !v.normalized)
            throw new Error(
              `Ungültiger JSON-Merge Pfad: ${j.path} (${v.errors.join(", ")})`,
            );
          const p = normalizePath(v.normalized);
          const old = snapMap.get(p) ?? null;
          const res = applyJsonMerge(old, j.patch, Boolean(j.createIfMissing));
          if (!res.ok)
            throw new Error(res.error || `JSON merge failed for ${p}`);
          mergeUpserts.push({ path: p, content: res.nextText });
          snapMap.set(p, res.nextText);
        }

        const upsertsRaw = [...(patch.upsert ?? []), ...mergeUpserts];
        const upserts: ProjectFile[] = upsertsRaw.map((u) => {
          const v = validateFilePath(u.path);
          if (!v.valid || !v.normalized) {
            throw new Error(
              `Ungültiger Upsert-Pfad: ${u.path} (${v.errors.join(", ")})`,
            );
          }
          const cRes = validateFileContent(u.content);
          if (!cRes.valid) {
            throw new Error(
              `Ungültiger File-Content für ${u.path}: ${cRes.error ?? "unknown"}`,
            );
          }
          return { path: v.normalized, content: u.content };
        });
        if (upserts.length) await updateProjectFiles(upserts);

        setHistory((prev) =>
          [
            {
              id: `h_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              at: Date.now(),
              label,
              snapshot,
              createdPaths,
              touchedPaths: normalizedTouched,
            },
            ...prev,
          ].slice(0, MAX_HISTORY),
        );

        Alert.alert("✅ Fix angewendet", label);
        setPreviewOpen(false);
      } catch (e: any) {
        await restore();
        Alert.alert(
          "❌ Fix fehlgeschlagen",
          e?.message || "Rollback durchgeführt.",
        );
      } finally {
        setApplyBusy(false);
      }
    },
    [applyBusy, deleteFile, projectData, updateProjectFiles],
  );

  const undoLast = useCallback(async () => {
    const last = history[0];
    if (!last || !projectData) return;
    try {
      for (const p of last.createdPaths ?? []) {
        await deleteFile(p);
      }
      if (last.snapshot.length) {
        await updateProjectFiles(last.snapshot);
      }
      setHistory((prev) => prev.slice(1));
      Alert.alert("↶ Undo", `Zurückgesetzt: ${last.label}`);
    } catch (e: any) {
      Alert.alert("Undo fehlgeschlagen", e?.message || "Unbekannter Fehler");
    }
  }, [deleteFile, history, projectData, updateProjectFiles]);

  const applySelected = useCallback(() => {
    if (applyBusy) return;
    const patches = selectableFixes
      .filter((r) => selected.has(r.id) && r.fix?.patch)
      .map((r) => r.fix!.patch);
    if (!patches.length) return;
    const merged = mergePatches(patches);
    openFixPreview(`Batch Fix (${patches.length})`, merged);
  }, [applyBusy, openFixPreview, selectableFixes, selected]);

  const autoFixAll = useCallback(() => {
    if (!projectData) {
      Alert.alert("Kein Projekt", "Öffne oder importiere zuerst ein Projekt.");
      return;
    }
    if (running || applyBusy || autoFixBusy) return;

    const items = selectableFixes
      .filter((r) => r.fix?.patch)
      .map((r) => ({ id: r.id, patch: r.fix!.patch }));

    if (!items.length) {
      Alert.alert(
        "AutoFix",
        "Für die aktuellen Findings gibt es keine automatischen Fixes.",
      );
      return;
    }

    Alert.alert(
      "✨ AutoFix",
      `Soll ich ${items.length} Fix(es) automatisch anwenden?\n\nTipp: Du kannst danach jederzeit mit Undo zurück.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Anwenden",
          style: "default",
          onPress: () => {
            void (async () => {
              try {
                setSelected(new Set(items.map((x) => x.id)));
                setAutoFixTotal(items.length);
                setAutoFixStage("Bereite Fixes vor…");
                setAutoFixBusy(true);

                const merged = mergePatches(items.map((x) => x.patch));
                setAutoFixStage("Wende Fixes an…");
                await applyPatch(`AutoFix (${items.length})`, merged);
              } finally {
                if (mountedRef.current) {
                  setAutoFixStage("");
                  setAutoFixBusy(false);
                }
              }
            })();
          },
        },
      ],
    );
  }, [
    applyBusy,
    applyPatch,
    autoFixBusy,
    projectData,
    running,
    selectableFixes,
  ]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const selectAllFails = useCallback(() => {
    setSelected(
      new Set(
        selectableFixes.filter((x) => x.status === "fail").map((x) => x.id),
      ),
    );
  }, [selectableFixes]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const copyReport = useCallback(async () => {
    const report = {
      project: projectData?.name ?? null,
      target,
      counts,
      results,
    };
    const text = safeTruncate(JSON.stringify(report, null, 2), 20_000).text;
    await Clipboard.setStringAsync(text);
    Alert.alert("Kopiert", "Report ist im Clipboard.");
  }, [counts, projectData?.name, results, target]);

  const upload = useCallback(async () => {
    if (!projectData) return;

    if (uploadBusyRef.current) return;

    if (uploadCooldownLeftSec > 0) {
      Alert.alert("⏳ Cooldown", `Bitte warte noch ${uploadCooldownLeftSec}s.`);
      return;
    }

    if (!results.length) {
      Alert.alert("Kein Report", "Erst 'Run' ausführen, dann Upload.");
      return;
    }

    uploadBusyRef.current = true;
    setUploadBusy(true);
    try {
      const deviceId = await getOrCreateDeviceId();
      const payload = formatDiagnosticUpload({
        deviceId,
        projectName: projectData.name,
        target,
        results,
        files,
      });
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
      Alert.alert("✅ Upload OK", `ID: ${id.id}`);
    } catch (e: any) {
      // Short retry delay for UX (not security). Real protection is DB rate limiting.
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
  }, [files, projectData, results, target, uploadBusy, uploadCooldownLeftSec]);

  const previewEntries = useMemo(() => {
    if (!previewPatch) return [];
    return buildPreviewEntries(files, previewPatch);
  }, [files, previewPatch]);

  const order = useMemo(() => ({ fail: 0, warn: 1, pass: 2 }) as const, []);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => order[a.status] - order[b.status]);
  }, [order, results]);

  useEffect(() => {
    // if results list changes drastically, keep selection sane
    const ids = new Set(results.map((r) => r.id));
    setSelected(
      (prev) => new Set(Array.from(prev).filter((id) => ids.has(id))),
    );
  }, [results]);

  const Header = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.h1}>Diagnostics</Text>
        <View style={styles.chips}>
          <View style={[styles.chip, styles.chipPass]}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={theme.palette.success}
            />
            <Text style={styles.chipText}>Pass {counts.pass}</Text>
          </View>
          <View style={[styles.chip, styles.chipWarn]}>
            <Ionicons name="warning" size={14} color={theme.palette.warning} />
            <Text style={styles.chipText}>Warn {counts.warn}</Text>
          </View>
          <View style={[styles.chip, styles.chipFail]}>
            <Ionicons
              name="close-circle"
              size={14}
              color={theme.palette.error}
            />
            <Text style={styles.chipText}>Fail {counts.fail}</Text>
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.pill, target.mode === "expoGo" && styles.pillOn]}
          onPress={() => setTarget({ mode: "expoGo" })}
          disabled={running}
          accessibilityRole="button"
        >
          <Text style={styles.pillText}>Expo Go</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pill,
            target.mode === "eas" &&
              target.profile === "preview" &&
              styles.pillOn,
          ]}
          onPress={() => setTarget({ mode: "eas", profile: "preview" })}
          disabled={running}
          accessibilityRole="button"
        >
          <Text style={styles.pillText}>EAS Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pill,
            target.mode === "eas" &&
              target.profile === "production" &&
              styles.pillOn,
          ]}
          onPress={() => setTarget({ mode: "eas", profile: "production" })}
          disabled={running}
          accessibilityRole="button"
        >
          <Text style={styles.pillText}>EAS Prod</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.btn, styles.btnGrid, running && styles.btnDisabled]}
          onPress={run}
          disabled={running}
        >
          <Ionicons name="play" size={16} color={theme.palette.text.primary} />
          <Text style={styles.btnText}>{running ? "Running…" : "Run"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnGrid,
            styles.btnPrimary,
            (!autoFixAvailable || running || applyBusy || autoFixBusy) &&
              styles.btnDisabled,
          ]}
          onPress={autoFixAll}
          disabled={!autoFixAvailable || running || applyBusy || autoFixBusy}
        >
          <Ionicons
            name="sparkles"
            size={16}
            color={theme.palette.text.primary}
          />
          <Text style={styles.btnText}>
            {autoFixAvailable
              ? `AutoFix (${selectableFixes.length})`
              : "AutoFix"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnGrid]}
          onPress={copyReport}
          disabled={running}
        >
          <Ionicons name="copy" size={16} color={theme.palette.text.primary} />
          <Text style={styles.btnText}>Copy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnGrid,
            (running || uploadBusy || uploadCooldownLeftSec > 0) &&
              styles.btnDisabled,
          ]}
          onPress={upload}
          disabled={running || uploadBusy || uploadCooldownLeftSec > 0}
        >
          <Ionicons
            name="cloud-upload"
            size={16}
            color={theme.palette.text.primary}
          />
          <Text style={styles.btnText}>
            {uploadBusy
              ? "Uploading…"
              : uploadCooldownLeftSec > 0
                ? `Upload (${uploadCooldownLeftSec}s)`
                : "Upload"}
          </Text>
        </TouchableOpacity>
      </View>

      {progressStage ? (
        <Text style={styles.progress}>{progressStage}</Text>
      ) : null}

      {!running &&
      results.length > 0 &&
      selectedCount === 0 &&
      autoFixAvailable ? (
        <Text style={styles.hint}>
          Tipp: Drück <Text style={styles.hintStrong}>AutoFix</Text> oder {'"'}
          Select fails{'"'} + {'"'}Fix Selected{'"'}.
        </Text>
      ) : null}

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btnSmall, selectedCount === 0 && styles.btnDisabled]}
          onPress={applySelected}
          disabled={selectedCount === 0 || running || applyBusy}
        >
          <Text style={styles.btnSmallText}>
            Fix Selected ({selectedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSmall}
          onPress={selectAllFails}
          disabled={running || applyBusy}
        >
          <Text style={styles.btnSmallText}>Select fails</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSmall}
          onPress={clearSelection}
          disabled={running || applyBusy}
        >
          <Text style={styles.btnSmallText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btnSmall, history.length === 0 && styles.btnDisabled]}
          onPress={undoLast}
          disabled={history.length === 0 || running || applyBusy}
        >
          <Text style={styles.btnSmallText}>Undo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Modal visible={autoFixBusy} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Ionicons
              name="sparkles"
              size={26}
              color={theme.palette.text.primary}
            />
            <Text style={styles.overlayTitle}>AutoFix</Text>
            <Text style={styles.overlaySub}>
              {autoFixStage || "Bitte warten…"}
            </Text>
            {autoFixTotal ? (
              <Text style={styles.overlaySub2}>{autoFixTotal} Fix(es)</Text>
            ) : null}
            <ActivityIndicator size="small" color={theme.palette.primary} />
          </View>
        </View>
      </Modal>
      {Header}
      <FlatList
        data={sortedResults}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const canFix = Boolean(item.fix?.patch);
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[
                styles.card,
                item.status === "fail" && styles.cardFail,
                item.status === "warn" && styles.cardWarn,
              ]}
              onPress={() => (canFix ? toggleSelected(item.id) : undefined)}
              disabled={!canFix || running || applyBusy}
            >
              <View style={styles.cardRow}>
                {canFix ? (
                  <TouchableOpacity
                    onPress={() => toggleSelected(item.id)}
                    style={[styles.checkbox, isSelected && styles.checkboxOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    {isSelected ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={theme.palette.text.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.checkboxPlaceholder} />
                )}

                <Ionicons
                  name={statusIcon(item.status) as any}
                  size={18}
                  color={statusColor(item.status)}
                />
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>

              {item.message ? (
                <Text style={styles.msg}>{item.message}</Text>
              ) : null}

              {item.details?.length ? (
                <View style={styles.details}>
                  {item.details.slice(0, 10).map((d: string, i: number) => (
                    <Text
                      key={`${item.id}_${i}`}
                      style={styles.detail}
                      numberOfLines={2}
                    >
                      • {safeTruncate(d, 180).text}
                    </Text>
                  ))}
                </View>
              ) : null}

              {canFix ? (
                <View style={styles.fixRow}>
                  <TouchableOpacity
                    style={[styles.btnSmall, styles.btnOutline]}
                    onPress={() =>
                      openFixPreview(
                        item.fix?.label || "Fix Preview",
                        item.fix!.patch,
                      )
                    }
                    disabled={running || applyBusy}
                  >
                    <Text style={styles.btnSmallText}>Preview</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />

      <Modal
        visible={previewOpen}
        animationType="slide"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{previewTitle}</Text>
            <TouchableOpacity
              onPress={() => setPreviewOpen(false)}
              style={styles.modalClose}
              accessibilityRole="button"
            >
              <Ionicons
                name="close"
                size={22}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {previewPatch?.explanation ? (
              <Text style={styles.explain}>{previewPatch.explanation}</Text>
            ) : null}

            {previewPatch?.delete?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delete</Text>
                {previewPatch.delete.map((p: string) => (
                  <Text key={p} style={styles.mono}>
                    - {p}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Changes</Text>
              {previewEntries.map((e) => (
                <View key={`${e.kind}:${e.path}`} style={styles.diffBlock}>
                  <Text style={styles.diffTitle}>
                    {e.path}{" "}
                    <Text style={styles.diffKind}>
                      ({e.kind}
                      {e.note ? `: ${e.note}` : ""})
                    </Text>
                  </Text>
                  <DiffPreview
                    oldText={safeTruncate(e.oldText ?? "", 12_000).text}
                    newText={safeTruncate(e.newText ?? "", 12_000).text}
                  />
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnPrimary,
                applyBusy && styles.btnDisabled,
              ]}
              onPress={() =>
                previewPatch && applyPatch(previewTitle, previewPatch)
              }
              disabled={applyBusy}
            >
              <Ionicons
                name="checkmark"
                size={16}
                color={theme.palette.text.primary}
              />
              <Text style={styles.btnText}>
                {applyBusy ? "Applying…" : "Apply"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  header: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  chipPass: { borderColor: "rgba(0,255,170,0.35)" },
  chipWarn: { borderColor: "rgba(255,200,0,0.35)" },
  chipFail: { borderColor: "rgba(255,80,80,0.35)" },
  chipText: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  h1: { color: theme.palette.text.primary, fontSize: 22, fontWeight: "800" },
  sub: { color: theme.palette.text.muted, marginTop: 4 },
  row: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  progress: { color: theme.palette.text.muted, marginTop: 8 },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  btnGrid: { width: "48%", justifyContent: "center" },
  hint: { color: theme.palette.text.muted, marginTop: 8, lineHeight: 18 },
  hintStrong: { color: theme.palette.text.primary, fontWeight: "900" },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  pillOn: {
    borderColor: theme.palette.text.accent,
    backgroundColor: "rgba(0,255,170,0.06)",
  },
  pillText: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  btnPrimary: { borderColor: theme.palette.text.accent },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: theme.palette.text.primary, fontWeight: "700" },
  btnSmall: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  btnOutline: { backgroundColor: "transparent" },
  btnSmallText: {
    color: theme.palette.text.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  list: { padding: 12, paddingBottom: 30 },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 10,
  },
  cardFail: { borderColor: "rgba(255,80,80,0.5)" },
  cardWarn: { borderColor: "rgba(255,200,0,0.5)" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: theme.palette.text.accent,
    backgroundColor: "rgba(0,255,170,0.12)",
  },
  checkboxPlaceholder: { width: 20, height: 20 },
  title: { color: theme.palette.text.primary, fontWeight: "800", flex: 1 },
  msg: { color: theme.palette.text.muted, marginTop: 6 },
  details: { marginTop: 8 },
  detail: { color: theme.palette.text.muted, marginTop: 2 },
  fixRow: { marginTop: 10, flexDirection: "row", gap: 10 },
  modal: { flex: 1, backgroundColor: theme.palette.background },
  modalHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 16,
    flex: 1,
  },
  modalClose: { padding: 6 },
  modalBody: { padding: 14, paddingBottom: 30 },
  explain: { color: theme.palette.text.muted, marginBottom: 10 },
  section: { marginTop: 12 },
  sectionTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    marginBottom: 8,
  },
  mono: { color: theme.palette.text.muted, fontFamily: "monospace" },
  diffBlock: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 10,
  },
  diffTitle: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    marginBottom: 8,
  },
  diffKind: { color: theme.palette.text.muted, fontWeight: "700" },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  overlayTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 18,
  },
  overlaySub: { color: theme.palette.text.muted, textAlign: "center" },
  overlaySub2: { color: theme.palette.text.primary, fontWeight: "800" },
});

export default DiagnosticScreen;
