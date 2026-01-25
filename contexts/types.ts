// contexts/types.ts

import type { BuildStatus } from "../lib/buildStatusMapper";

// Which scaffold template the user prefers for newly created projects
export type TemplateId = "base" | "navigation" | "crud";

export interface ProjectFile {
  path: string;
  content: string;
}

export interface BuildHistoryEntry {
  id: string;
  jobId: number;
  repoName: string;
  status: BuildStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  buildProfile?: string;
  artifactUrl?: string | null;
  htmlUrl?: string | null;
  errorMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  meta?: {
    provider?: string;
    error?: boolean;
    autoFix?: boolean;
    planner?: boolean;
  };
}

export interface AutoFixRequest {
  id: string;
  message: string;
  timestamp: string;
}

export interface ProjectData {
  id?: string;
  name: string;
  slug?: string;
  packageName?: string;
  /** Selected template for the project (also used as default for next scaffolds). */
  templateId?: TemplateId;
  files: ProjectFile[];
  chatHistory: ChatMessage[];
  messages?: ChatMessage[];
  createdAt: string;
  lastModified: string;
  /** Verknüpftes GitHub Repo (full_name: owner/repo) */
  linkedRepo?: string | null;
  /** Verknüpfter Branch (z.B. "main") */
  linkedBranch?: string | null;
  /** Bevorzugtes EAS Build-Profil (persistiert) */
  preferredBuildProfile?: "development" | "preview" | "production" | null;
}

export interface ProjectContextProps {
  projectData: ProjectData | null;
  isLoading: boolean;

  updateProjectFiles: (files: ProjectFile[], newName?: string) => Promise<void>;
  createFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;

  setPackageName: (packageName: string) => void;
  setProjectName: (name: string) => void;
  createNewProject: () => Promise<void>;

  /** Persist preferred template id (used for next new project / repo scaffold). */
  setTemplateId?: (templateId: TemplateId) => Promise<void>;

  addChatMessage: (message: ChatMessage) => void;
  messages: ChatMessage[];

  clearChatHistory: () => void;

  autoFixRequest: AutoFixRequest | null;
  triggerAutoFix: (message: string) => void;
  clearAutoFixRequest: () => void;

  /**
   * Startet einen EAS Build über Supabase (trigger-eas-build).
   * Optional mit Build-Profile (development|preview|production).
   */
  startBuild?: (buildProfile?: string) => Promise<void>;
  currentBuild?: {
    status: BuildStatus;
    message?: string;
    progress?: number; // 0..1 (optional UI-Hilfe)
    jobId?: number | null;
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

  /** Verknüpft Repo+Branch mit dem Projekt (persistent) */
  setLinkedRepo: (repo: string | null, branch?: string | null) => Promise<void>;
  setPreferredBuildProfile?: (
    profile: "development" | "preview" | "production",
  ) => Promise<void>;
}
