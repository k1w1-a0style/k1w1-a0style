import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";


import type { PreflightCheckResult, PreflightTarget } from "../../../lib/diagnostics/preflightTypes";
import { formatDiagnosticUpload, uploadDiagnosticToSupabase } from "../../../lib/diagnostics/diagnosticUploader";
import { sanitizeDiagnosticUpload, safeTruncateText } from "../../../lib/diagnostics/sanitize";

import type { ProjectData } from "../../../shared/types/project";
import { getDiagnosticUiErrorMessage } from "./diagnosticErrorHelpers";
const DEVICE_ID_KEY = "k1w1_device_id";
const UPLOAD_COOLDOWN_MS = 30_000;
const UPLOAD_RETRY_DELAY_MS = 3_000;
const UPLOAD_COOLDOWN_KEY = "k1w1_upload_cooldown_until";

export function useDiagnosticUpload(opts: {
  projectRef: MutableRefObject<ProjectData | null>;
  mountedRef: MutableRefObject<boolean>;
  results: PreflightCheckResult[];
  target: PreflightTarget;
}) {
  const { projectRef, mountedRef, results, target } = opts;

  const [uploadCooldownUntil, setUploadCooldownUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());

  const uploadCooldownLeftSec = useMemo(() => {
    if (!uploadCooldownUntil) return 0;
    const left = uploadCooldownUntil - cooldownNow;
    return left > 0 ? Math.ceil(left / 1000) : 0;
  }, [uploadCooldownUntil, cooldownNow]);

  // Load persisted cooldown (so it survives app reload)
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

  // Tick cooldown countdown
  useEffect(() => {
    if (!uploadCooldownUntil) return;
    const tick = () => {
      const now = Date.now();
      if (!mountedRef.current) return;
      setCooldownNow(now);
      if (uploadCooldownUntil <= now) {
        setUploadCooldownUntil(0);
        AsyncStorage.removeItem(UPLOAD_COOLDOWN_KEY).catch((error) => {
          console.warn("[useDiagnosticUpload] failed to clear expired upload cooldown", error);
        });
      }
    };
    tick();
    if (uploadCooldownUntil <= Date.now()) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [mountedRef, uploadCooldownUntil]);

  const uploadBusyRef = useRef(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  // Client request id (short-lived) to correlate retries in backend logs
  const uploadClientRequestIdRef = useRef<string | null>(null);
  const uploadClientRequestIdExpiresAtRef = useRef<number>(0);

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
        AsyncStorage.setItem(UPLOAD_COOLDOWN_KEY, String(until)).catch((error) => {
          console.warn("[useDiagnosticUpload] failed to persist upload cooldown", error);
        });
      }

      Alert.alert("■ Upload OK", `ID: ${id.id}`);
    } catch (e: unknown) {
      if (mountedRef.current) {
        const until = Date.now() + UPLOAD_RETRY_DELAY_MS;
        setUploadCooldownUntil(until);
        setCooldownNow(Date.now());
        AsyncStorage.setItem(UPLOAD_COOLDOWN_KEY, String(until)).catch((error) => {
          console.warn("[useDiagnosticUpload] failed to persist retry cooldown", error);
        });
      }
      Alert.alert("Upload fehlgeschlagen", getDiagnosticUiErrorMessage(e));
    } finally {
      uploadBusyRef.current = false;
      if (mountedRef.current) setUploadBusy(false);
    }
  }, [
    getOrCreateDeviceId,
    getOrCreateUploadClientRequestId,
    mountedRef,
    projectRef,
    results,
    target,
    uploadCooldownLeftSec,
  ]);

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
    } catch (e: unknown) {
      Alert.alert("Kopieren fehlgeschlagen", getDiagnosticUiErrorMessage(e));
    }
  }, [getOrCreateDeviceId, getOrCreateUploadClientRequestId, projectRef, results, target]);

  return {
    uploadBusyRef,
    uploadBusy,
    uploadCooldownUntil,
    setUploadCooldownUntil,
    setCooldownNow,
    uploadCooldownLeftSec,
    getOrCreateUploadClientRequestId,
    resetUploadClientRequestId,
    upload,
    copyReport,
  };
}
