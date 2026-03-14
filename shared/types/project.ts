// shared/types/project.ts
// Central shared project-related types.
// Safe to import from any layer.

import type { ChatMessage } from './chat';

// Which scaffold template the user prefers for newly created projects
export type CoreTemplateId = "base" | "navigation" | "crud" | "full";
export type TemplateId = CoreTemplateId | "auto";

export interface ProjectFile {
  path: string;
  content: string;
}

// BuildHistoryEntry lives in shared/types/build.ts (single source of truth)
export type { BuildHistoryEntry } from './build';

export interface AutoFixRequest {
  id: string;
  message: string;
  timestamp: string;
}

export interface LastPreviewMeta {
  url: string | null;
  source: "supabase" | "local";
  createdAt: string;
  expiresAt?: string | null;
}

export type PreferredPreviewMode = "supabase" | "local";

export interface ProjectData {
  id?: string;
  name: string;
  slug?: string;
  packageName?: string;

  /** Selected template for the project (also used as default for next scaffolds). */
  templateId?: TemplateId;

  /** If templateId is "auto", this stores the last detected core template. */
  effectiveTemplateId?: CoreTemplateId;

  files: ProjectFile[];
  chatHistory: ChatMessage[];

  /** Some legacy screens still use `messages` – keep it optional for compatibility. */
  messages?: ChatMessage[];

  createdAt: string;
  lastModified: string;

  /** Linked GitHub Repo (full_name: owner/repo) */
  linkedRepo?: string | null;

  /** Linked branch (e.g. "main") */
  linkedBranch?: string | null;

  /** Preferred EAS build profile (persisted). */
  preferredBuildProfile?: "development" | "preview" | "production" | null;

  /** Dev: show manual template override/picker (default: false). */
  advancedTemplatePickerEnabled?: boolean;

  /** Last preview (for quick switching) */
  lastPreview?: LastPreviewMeta | null;

  /** Preferred preview engine for this project (visual supabase default, local fallback optional). */
  preferredPreviewMode?: PreferredPreviewMode;
}
