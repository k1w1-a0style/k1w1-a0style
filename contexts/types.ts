// contexts/types.ts
//
// ⚠️ Compatibility shim
// Historically, many parts of the app imported shared domain types from this file.
// PR-8 Stage 2 moves those types to shared/types/* and re-exports them here so
// existing imports keep working while avoiding type drift.
//
// @deprecated Import types from "shared/types/*" directly.

import type { BuildStatus } from "../shared/types/build";

export type { BuildStatus, BuildStatusDetails, BuildHistoryEntry } from "../shared/types/build";
export type { ChatMessage } from "../shared/types/chat";
export type {
  CoreTemplateId,
  TemplateId,
  ProjectFile,
  AutoFixRequest,
  LastPreviewMeta,
  ProjectData,
} from "../shared/types/project";

export interface ProjectContextProps {
  projectData: import("../shared/types/project").ProjectData | null;
  isLoading: boolean;

  updateProjectFiles: (
    files: import("../shared/types/project").ProjectFile[],
    newName?: string,
  ) => Promise<void>;
  createFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;

  setPackageName: (packageName: string) => void;
  setProjectName: (name: string) => void;
  createNewProject: () => Promise<void>;

  /** Persist preferred template id (used for next new project / repo scaffold). */
  setTemplateId?: (templateId: import("../shared/types/project").TemplateId) => Promise<void>;

  /** Dev: shows/hides manual template picker (Advanced). */
  setAdvancedTemplatePickerEnabled?: (enabled: boolean) => Promise<void>;

  addChatMessage: (message: import("../shared/types/chat").ChatMessage) => void;
  messages: import("../shared/types/chat").ChatMessage[];

  clearChatHistory: () => void;

  /** Persist last preview (for header quick switch). */
  setLastPreview: (
    preview: import("../shared/types/project").LastPreviewMeta | null,
  ) => Promise<void>;

  autoFixRequest: import("../shared/types/project").AutoFixRequest | null;
  triggerAutoFix: (message: string) => void;
  clearAutoFixRequest: () => void;

  /**
   * Starts an EAS build via Supabase (trigger-eas-build).
   * Optional with build profile (development|preview|production).
   */
  startBuild?: (buildProfile?: string) => Promise<void>;
  currentBuild?: {
    status: BuildStatus;
    message?: string;
    progress?: number; // 0..1 (optional UI helper)
    /** Supabase build_jobs.id (UUID) */
    jobId?: string | null;
    githubRepo?: string | null;
    buildProfile?: string;
    runId?: number | null;
    urls?: {
      html?: string | null;
      artifacts?: string | null;
      buildUrl?: string | null;
    };
    startedAt?: string;
    completedAt?: string;
    lastUpdatedAt?: string;
  } | null;

  exportAndBuild: () => Promise<{ owner: string; repo: string } | null>;
  exportProjectAsZip: () => Promise<void>;
  /** Export ONLY text files as ZIP (without assets/binaries). */
  exportTextFilesAsZip?: () => Promise<void>;
  importProjectFromZip: () => Promise<void>;

  getGitHubToken: () => Promise<string | null>;
  getWorkflowRuns: (
    owner: string,
    repo: string,
    workflowFileName?: string,
  ) => Promise<{
    workflow_runs?: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      created_at: string;
      updated_at: string;
      html_url: string;
    }>;
  }>;

  /** Link repo+branch with project (persistent) */
  setLinkedRepo: (repo: string | null, branch?: string | null) => Promise<void>;
  setPreferredBuildProfile?: (
    profile: "development" | "preview" | "production",
  ) => Promise<void>;
}
