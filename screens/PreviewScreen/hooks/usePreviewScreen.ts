// screens/PreviewScreen/hooks/usePreviewScreen.ts
//
// Extrahiert aus PreviewScreen.tsx (Patch 200).
// Kapselt: State, Animationen, Hot-Reload-Debounce, alle Handler.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProject } from '../../../contexts/ProjectContext';
import { usePreview } from '../../../hooks/usePreview';
import { logger } from '../../../lib/logger';
import {
  formatPreviewExpiry,
  getPreviewChannelLabel,
  getPreviewRemoteUrlStatus,
  isPreviewExpired,
  resolvePreviewDisplayState,
} from '../../../hooks/previewHelpers';
import { isHttpUrl } from '../../../utils/url';
import { useWebViewNavigation } from '../../shared/preview/useWebViewNavigation';
import { useWebViewCrashRecovery } from '../../shared/preview/useWebViewCrashRecovery';
import { redactPreviewUrl } from '../../shared/preview/previewUrlRedaction';
import type { WebView } from 'react-native-webview';
import type { RootStackParamList } from '../../../types/preview';

const HOT_RELOAD_DEBOUNCE_MS = 1200;

export type PreviewPhase = 'idle' | 'creating' | 'loading' | 'ready' | 'error';

export function usePreviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { projectData, isLoading } = useProject();
  const { state, lastPreview, createPreview, reset, filesFingerprint } = usePreview(projectData);

  const [phase, setPhase] = useState<PreviewPhase>('idle');
  const [webError, setWebError] = useState<string | null>(null);
  const [autoCreated, setAutoCreated] = useState(false);
  const [hotReloadEnabled, setHotReloadEnabled] = useState(true);
  const [hotReloadCount, setHotReloadCount] = useState(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hotDotAnim = useRef(new Animated.Value(1)).current;
  const flashBorderAnim = useRef(new Animated.Value(0)).current;

  // Refs
  const lastFingerprintRef = useRef(filesFingerprint);
  const hotReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreatingRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─── Preview source ────────────────────────────────────────────────────────
  const hasExpiredSupabaseUrl = useMemo(() => {
    if (lastPreview?.source !== 'supabase') return false;
    return isPreviewExpired(lastPreview?.expiresAt ?? null);
  }, [lastPreview?.source, lastPreview?.expiresAt]);

  const remoteUrlStatus = useMemo(
    () => getPreviewRemoteUrlStatus(lastPreview?.source === 'supabase' ? lastPreview?.url : null),
    [lastPreview?.source, lastPreview?.url],
  );

  const previewSource = useMemo(() => {
    if (
      lastPreview?.url &&
      isHttpUrl(lastPreview.url) &&
      remoteUrlStatus === 'trusted' &&
      !hasExpiredSupabaseUrl
    ) {
      return { type: 'url' as const, uri: lastPreview.url };
    }
    if (lastPreview?.html) {
      return { type: 'html' as const, html: lastPreview.html };
    }
    return null;
  }, [lastPreview, hasExpiredSupabaseUrl, remoteUrlStatus]);

  const mode = previewSource?.type ?? null;
  const url = previewSource?.type === 'url' ? previewSource.uri : null;

  const previewKind = lastPreview?.source ?? null;
  const previewUrl = useMemo(
    () =>
      previewKind === 'supabase' && remoteUrlStatus === 'trusted' && !hasExpiredSupabaseUrl
        ? lastPreview?.url ?? null
        : null,
    [previewKind, remoteUrlStatus, hasExpiredSupabaseUrl, lastPreview?.url],
  );
  const previewUrlDisplay = useMemo(() => redactPreviewUrl(previewUrl), [previewUrl]);
  const previewExpiryText = useMemo(
    () => formatPreviewExpiry(lastPreview?.expiresAt ?? null),
    [lastPreview?.expiresAt],
  );
  const transientLocalPreviewNotice = useMemo(() => {
    if (lastPreview?.source !== 'local') return null;
    if (previewSource) return null;
    return 'Der letzte lokale HTML-/Eval-Fallback war nur temporär und ist nach Restart/Rehydration nicht mehr verfügbar. Bitte die primäre Remote-Preview neu erstellen.';
  }, [lastPreview?.source, previewSource]);
  const displayState = useMemo(
    () =>
      resolvePreviewDisplayState({
        phase,
        previewKind: previewKind,
        previewSourceType: previewSource?.type ?? null,
        remoteUrlStatus,
        hasExpiredRemoteUrl: hasExpiredSupabaseUrl,
        remoteFailure: state.remoteFailure,
        stateError: state.error,
        webError,
        transientLocalPreviewNotice,
      }),
    [
      phase,
      previewKind,
      previewSource?.type,
      remoteUrlStatus,
      hasExpiredSupabaseUrl,
      state.remoteFailure,
      state.error,
      webError,
      transientLocalPreviewNotice,
    ],
  );
  const previewChannelLabel = useMemo(() => {
    if (displayState.kind === 'remote_ready') return getPreviewChannelLabel(previewKind);
    if (displayState.kind === 'fallback_active') {
      return 'Lokaler HTML-/Eval-Fallback (nur bei explizitem Local-/Dev-Modus, nicht server-verifiziert, Best-Effort)';
    }
    if (previewKind === 'supabase') {
      return 'Remote-Preview derzeit nicht verifiziert';
    }
    return getPreviewChannelLabel(previewKind);
  }, [displayState.kind, previewKind]);
  const runtimeHint = useMemo(() => {
    const sourceKind = previewKind ?? 'none';
    const sourceType = previewSource?.type ?? 'none';
    return `active=PreviewScreen source=${sourceKind}/${sourceType} state=${displayState.kind} phase=${phase}`;
  }, [displayState.kind, phase, previewKind, previewSource?.type]);

  // ─── Shared navigation (eliminiert Duplikat mit PreviewFullscreenScreen) ──
  const { originWhitelist, handleShouldStartLoad } = useWebViewNavigation({
    mode,
    url,
    confirmExternalLinks: false, // PreviewScreen öffnet externe Links direkt ohne Confirm
  });


  const { handleContentProcessDidTerminate, handleRenderProcessGone, resetRecoveryState } =
    useWebViewCrashRecovery({
      webViewRef,
      isMountedRef,
      onError: (message) => {
        setPhase('error');
        setWebError(message);
      },
      onLoadingChange: (loading) => {
        if (loading) setPhase('loading');
      },
    });

  // ─── Pulse animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'creating' || phase === 'loading') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, pulseAnim]);

  // ─── Fade in when ready ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'ready') {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [phase, fadeAnim]);

  const blinkHotDot = useCallback(() => {
    Animated.sequence([
      Animated.timing(hotDotAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(hotDotAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [hotDotAnim]);

  const flashBorder = useCallback(() => {
    flashBorderAnim.setValue(1);
    Animated.sequence([
      Animated.timing(flashBorderAnim, { toValue: 1, duration: 50, useNativeDriver: false }),
      Animated.timing(flashBorderAnim, { toValue: 0, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [flashBorderAnim]);

  // ─── Create ────────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setPhase('creating');
    setWebError(null);
    resetRecoveryState();
    try {
      const result = await createPreview();
      if (!result) {
        setPhase('error');
        setWebError('Preview konnte nicht erstellt werden.');
        return;
      }
      setPhase('loading');
      lastFingerprintRef.current = filesFingerprint;
    } catch (e: unknown) {
      setPhase('error');
      setWebError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      isCreatingRef.current = false;
    }
  }, [createPreview, filesFingerprint, resetRecoveryState]);

  // ─── Auto-create on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (autoCreated) return;
    if (isLoading || !projectData) return;
    if (previewSource) {
      lastFingerprintRef.current = filesFingerprint;
      return;
    }
    setAutoCreated(true);
    handleCreate();
  }, [isLoading, projectData, previewSource, autoCreated, handleCreate, filesFingerprint]);

  // ─── Hot Reload ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hotReloadEnabled) return;
    if (!previewSource) return;
    if (phase === 'creating') return;
    if (filesFingerprint === lastFingerprintRef.current) return;

    if (hotReloadTimerRef.current) clearTimeout(hotReloadTimerRef.current);
    hotReloadTimerRef.current = setTimeout(() => {
      lastFingerprintRef.current = filesFingerprint;
      blinkHotDot();
      flashBorder();
      setHotReloadCount((c) => c + 1);
      handleCreate();
    }, HOT_RELOAD_DEBOUNCE_MS);

    return () => {
      if (hotReloadTimerRef.current) clearTimeout(hotReloadTimerRef.current);
    };
  }, [filesFingerprint, hotReloadEnabled, previewSource, phase, handleCreate, blinkHotDot, flashBorder]);

  // ─── Other handlers ────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    reset();
    setAutoCreated(false);
    setPhase('idle');
    setWebError(null);
    setHotReloadCount(0);
  }, [reset]);

  const handleCopy = useCallback(async () => {
    if (previewUrl) {
      Alert.alert(
        'Secret-Link teilen?',
        `Dieser Link enthaelt ein Zugriffstoken.\n\n${previewUrlDisplay}\n\nNur ueber sichere Kanaele teilen.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Trotzdem kopieren',
            style: 'destructive',
            onPress: () => {
              void Clipboard.setStringAsync(previewUrl);
              Alert.alert('Kopiert', 'Preview-Link wurde bewusst in die Zwischenablage uebernommen.');
            },
          },
        ],
      );
    }
  }, [previewUrl, previewUrlDisplay]);


  const handleOpenExternal = useCallback(async () => {
    if (previewUrl) {
      Alert.alert(
        'Secret-Link im Browser oeffnen?',
        `Der externe Browser kann den Link in Verlauf/Referrer sichtbar machen.\n\n${previewUrlDisplay}`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Im Browser oeffnen',
            onPress: () => {
              void Linking.openURL(previewUrl).catch((error) => {
                logger.warn('[PreviewScreen] open external preview URL failed', {
                  error,
                  hasPreviewUrl: true,
                  previewUrlDisplay,
                });
                Alert.alert('Fehler', 'Browser konnte nicht geoeffnet werden.');
              });
            },
          },
        ],
      );
    }
  }, [previewUrl, previewUrlDisplay]);


  const canOpenFullscreen = Boolean(previewSource);

  const handleFullscreen = useCallback(() => {
    if (!previewSource) return;
    navigation.navigate('PreviewFullscreen', {
      url: previewSource.type === 'url' ? previewSource.uri : undefined,
      html: previewSource.type === 'html' ? previewSource.html : undefined,
      title: projectData?.name || 'Preview',
    });
  }, [navigation, previewSource, projectData?.name]);

  return {
    projectData,
    isLoading,
    state,
    lastPreview,
    previewSource,
    previewKind,
    previewUrl,
    previewUrlDisplay,
    previewExpiryText,
    canOpenFullscreen,
    previewChannelLabel,
    transientLocalPreviewNotice,
    displayState,
    runtimeHint,
    phase,
    setPhase,
    webError,
    setWebError,
    hotReloadEnabled,
    setHotReloadEnabled,
    hotReloadCount,
    pulseAnim,
    fadeAnim,
    hotDotAnim,
    flashBorderAnim,
    webViewRef,
    originWhitelist,
    handleShouldStartLoad,
    handleContentProcessDidTerminate,
    handleRenderProcessGone,
    resetRecoveryState,
    handleCreate,
    handleReset,
    handleCopy,
    handleOpenExternal,
    handleFullscreen,
  };
}
