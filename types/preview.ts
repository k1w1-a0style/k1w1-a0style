// types/preview.ts
// Unified types for Preview functionality

export type PreviewMode = "sandpack" | "supabase" | "web";

export type PreviewFiles = Record<string, { type?: string; contents: string }>;

export interface PreviewResponse {
  ok: boolean;
  previewId?: string | null;
  previewUrl?: string;
  expiresAt?: string | null;
  error?: string;
  hint?: string;
}

export interface PreviewSettings {
  defaultMode: PreviewMode;
  autoFullscreen: boolean;
  defaultWebUrl: string;
}

export interface PreviewStats {
  fileCount: number;
  totalBytes: number;
  skipped: number;
}

// Navigation types
export type RootStackParamList = {
  Root: undefined;
  PreviewFullscreen: {
    url?: string;
    html?: string;
    title?: string;
    baseUrl?: string;
  };
};

export type PreviewFullscreenParams = RootStackParamList["PreviewFullscreen"];
