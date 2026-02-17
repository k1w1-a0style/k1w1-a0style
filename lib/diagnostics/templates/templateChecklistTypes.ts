// lib/diagnostics/templates/templateChecklistTypes.ts

export type ChecklistSeverity = "P0" | "P1" | "P2";

export type ChecklistItem = {
  severity: ChecklistSeverity;
  file?: string;
  reason: string;
  fix?: string;
};

export type TemplateChecklistReport = {
  ok: boolean;
  issues: ChecklistItem[];
  summary: string;
};

export type TemplateChecklistOptions = {
  autofix?: boolean;
  toolchain?: {
    expo: string; // e.g. "~54.0.32"
    react: string; // e.g. "19.1.0"
    reactDom: string; // e.g. "19.1.0"
    reactNative: string; // e.g. "0.81.5"
    jestExpo?: string; // e.g. "~54.0.16"
  };
};

// Template file map used across checklist + patchers.
// Values are plain text or "base64:..." strings for binary blobs.
export type TemplateFileMap = Record<string, string>;
