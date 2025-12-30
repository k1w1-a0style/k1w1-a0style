// lib/previewSettings.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PreviewMode = "supabase" | "codesandbox" | "web";

export type PreviewSettings = {
  defaultMode: PreviewMode;
  autoFullscreen: boolean;
  defaultWebUrl: string;
};

const STORAGE_KEY = "k1w1.previewSettings.v1";

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  defaultMode: "supabase",
  autoFullscreen: true,
  defaultWebUrl: "https://codesandbox.io/",
};

export async function loadPreviewSettings(): Promise<PreviewSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREVIEW_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PreviewSettings>;
    return { ...DEFAULT_PREVIEW_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_PREVIEW_SETTINGS };
  }
}

export async function savePreviewSettings(
  settings: PreviewSettings,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function patchPreviewSettings(
  patch: Partial<PreviewSettings>,
): Promise<PreviewSettings> {
  const current = await loadPreviewSettings();
  const next: PreviewSettings = { ...current, ...patch };
  await savePreviewSettings(next);
  return next;
}

export async function resetPreviewSettings(): Promise<PreviewSettings> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  const next = { ...DEFAULT_PREVIEW_SETTINGS };
  await savePreviewSettings(next);
  return next;
}
