import type { BuildStatus } from "../shared/types/build";
import type { ChatMessage } from "../shared/types/chat";
import type { FileCommandResult } from "./projectContext/projectContext.contracts";
import type {
  AutoFixRequest,
  LastPreviewMeta,
  ProjectData,
  ProjectFile,
  TemplateId,
  PreferredPreviewMode,
} from "../shared/types/project";

export interface ProjectContextProps {
  projectData: ProjectData | null;
  isLoading: boolean;
  isRecoveryMode?: boolean;
  recoveryModeReason?: string | null;

  updateProjectFiles: (files: ProjectFile[], newName?: string) => Promise<void>;
  replaceProjectFiles?: (files: ProjectFile[]) => Promise<void>;
  createFile: (path: string, content: string) => Promise<FileCommandResult>;
  deleteFile: (path: string) => Promise<FileCommandResult>;
  deleteFiles?: (paths: string[]) => Promise<FileCommandResult>;
  renameFile: (oldPath: string, newPath: string) => Promise<FileCommandResult>;

  setPackageName: (packageName: string) => void;
  setProjectName: (name: string) => void;
  createNewProject: () => Promise<void>;

  /** Persist preferred template id (used for next new project / repo scaffold). */
  setTemplateId?: (templateId: TemplateId) => Promise<void>;

  /** Dev: shows/hides manual template picker (Advanced). */
  setAdvancedTemplatePickerEnabled?: (enabled: boolean) => Promise<void>;

  addChatMessage: (message: ChatMessage) => void;
  setChatRetentionLimit: (limit: number) => Promise<void>;
  messages: ChatMessage[];

  clearChatHistory: () => void;

  /** Persist last preview (for header quick switch). */
  setLastPreview: (preview: LastPreviewMeta | null) => Promise<void>;

  autoFixRequest: AutoFixRequest | null;
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
    branch?: string | null;
    buildProfile?: string;
    runId?: number | null;
    sourceCommitSha?: string | null;
    urls?: {
      html?: string | null;
      artifacts?: string | null;
      buildUrl?: string | null;
    };
    startedAt?: string;
    completedAt?: string;
    lastUpdatedAt?: string;
  } | null;

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

  /** Persist preferred preview mode (supabase visual preview preferred, local fallback optional). */
  setPreferredPreviewMode?: (mode: PreferredPreviewMode) => Promise<void>;

}
