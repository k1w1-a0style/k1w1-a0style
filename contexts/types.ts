// contexts/types.ts

// =====================================
// Project Types
// =====================================

export type ProjectFile = {
  path: string;
  content: string;
};

export interface ProjectData {
  id: string;
  name: string;
  slug: string;
  files: ProjectFile[];
  chatHistory: ChatMessage[];
  createdAt: string;
  lastModified: string;
  packageName?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: BuilderContextData;
}

export interface BuilderContextData {
  provider?: string;
  model?: string;
  duration?: number;
  totalLines?: number;
  keysRotated?: number;
  files?: ProjectFile[];
  changes?: ContextFileChange[];
  filesChanged?: ContextFileChange[]; // legacy
  error?: string;
  success?: boolean;
}

export interface ContextFileChange {
  path: string;
  type: 'created' | 'updated' | 'deleted';
  linesAdded?: number;
  linesRemoved?: number;
  diff?: string;
}

export interface ProjectContextProps {
  projectData: ProjectData | null;
  isLoading: boolean;
  updateProjectFiles: (files: ProjectFile[], newName?: string) => Promise<void>;
  createFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  updateFileContent: (path: string, content: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  setPackageName: (packageName: string) => void;
  setProjectName: (name: string) => void;
  createNewProject: () => Promise<void>;
  addChatMessage: (message: ChatMessage) => void;
  messages: ChatMessage[];
  exportAndBuild: () => Promise<string | null>;
  exportProjectAsZip: () => Promise<void>;
  importProjectFromZip: () => Promise<void>;
}

// =====================================
// GitHub Actions Types
// =====================================

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  event: string;
  workflow_id: number;
  run_number: number;
  run_attempt: number;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
  html_url: string;
  jobs_url: string;
  logs_url: string;
  check_suite_url: string;
  artifacts_url: string;
  cancel_url: string;
  rerun_url: string;
  display_title?: string;
  actor?: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubWorkflowJob {
  id: number;
  run_id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  started_at?: string;
  completed_at?: string;
  html_url: string;
  steps: GitHubWorkflowStep[];
  runner_name?: string;
  runner_group_name?: string;
}

export interface GitHubWorkflowStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  number: number;
  started_at?: string;
  completed_at?: string;
}

export interface GitHubWorkflowRunsResponse {
  total_count: number;
  workflow_runs: GitHubWorkflowRun[];
}

export interface GitHubWorkflowJobsResponse {
  total_count: number;
  jobs: GitHubWorkflowJob[];
}

export interface GitHubArtifact {
  id: number;
  node_id: string;
  name: string;
  size_in_bytes: number;
  url: string;
  archive_download_url: string;
  expired: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
  workflow_run?: {
    id: number;
    head_sha: string;
  };
}

export interface GitHubArtifactsResponse {
  total_count: number;
  artifacts: GitHubArtifact[];
}

// =====================================
// Build Status Types
// =====================================

export type BuildPhase = 
  | 'idle' 
  | 'queued' 
  | 'checkout' 
  | 'setup' 
  | 'install' 
  | 'building' 
  | 'uploading' 
  | 'success' 
  | 'failed' 
  | 'error';

export interface BuildStepInfo {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number; // in seconds
}

export interface LiveBuildStatus {
  phase: BuildPhase;
  run?: GitHubWorkflowRun;
  job?: GitHubWorkflowJob;
  steps: BuildStepInfo[];
  logs: LogLine[];
  artifacts: GitHubArtifact[];
  progress: number; // 0-100
  eta?: string; // estimated time remaining
  startedAt?: string;
  completedAt?: string;
  totalDuration?: number; // in seconds
}

export interface LogLine {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stepName?: string;
}

// =====================================
// Repository Types
// =====================================

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description?: string;
  updated_at: string;
  html_url: string;
  default_branch: string;
  language?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  owner: {
    login: string;
    avatar_url?: string;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

// =====================================
// Workflow Types
// =====================================

export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled_fork' | 'disabled_manually' | 'disabled_inactivity';
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
  badge_url: string;
}

export interface GitHubWorkflowsResponse {
  total_count: number;
  workflows: GitHubWorkflow[];
}
