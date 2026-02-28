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
import { isHttpUrl } from '../../../utils/url';
import { useWebViewNavigation } from '../../shared/preview/useWebViewNavigation';
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

  // ─── Preview source ────────────────────────────────────────────────────────
  const previewSource = useMemo(() => {
    if (lastPreview?.url && isHttpUrl(lastPreview.url)) {
      return { type: 'url' as const, uri: lastPreview.url };
    }
    if (lastPreview?.html) {
      return { type: 'html' as const, html: lastPreview.html };
    }
    return null;
  }, [lastPreview]);

  const mode = previewSource?.type ?? null;
  const url = previewSource?.type === 'url' ? previewSource.uri : null;

  // ─── Shared navigation (eliminiert Duplikat mit PreviewFullscreenScreen) ──
  const { originWhitelist, handleShouldStartLoad } = useWebViewNavigation({
    mode,
    url,
    confirmExternalLinks: false, // PreviewScreen öffnet externe Links direkt ohne Confirm
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
  }, [createPreview, filesFingerprint]);

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
    if (lastPreview?.url) {
      await Clipboard.setStringAsync(lastPreview.url);
      Alert.alert('Kopiert', 'Preview-URL in Zwischenablage.');
    }
  }, [lastPreview]);

  const handleOpenExternal = useCallback(async () => {
    if (lastPreview?.url) {
      try {
        await Linking.openURL(lastPreview.url);
      } catch {
        Alert.alert('Fehler', 'Browser konnte nicht geoeffnet werden.');
      }
    }
  }, [lastPreview]);

  const handleFullscreen = useCallback(() => {
    if (!lastPreview) return;
    navigation.navigate('PreviewFullscreen', {
      url: lastPreview.url ?? undefined,
      html: lastPreview.html ?? undefined,
      title: projectData?.name || 'Preview',
    });
  }, [navigation, lastPreview, projectData?.name]);

  return {
    projectData,
    isLoading,
    state,
    lastPreview,
    previewSource,
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
    originWhitelist,
    handleShouldStartLoad,
    handleCreate,
    handleReset,
    handleCopy,
    handleOpenExternal,
    handleFullscreen,
  };
}
