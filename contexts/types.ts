// contexts/types.ts - VEREINHEITLICHT & REPARIERT

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  meta?: {                          // ✅ NEU: Optional meta-Daten
    provider?: string;
    error?: boolean;
  };
}

export interface ProjectData {
  id?: string;
  name: string;
  slug?: string;
  packageName?: string;
  files: ProjectFile[];
  chatHistory: ChatMessage[];
  messages?: ChatMessage[];
  createdAt: string;
  lastModified: string;
}

export interface ProjectContextProps {
  projectData: ProjectData | null;
  isLoading: boolean;

  // File operations
  updateProjectFiles: (files: ProjectFile[], newName?: string) => Promise<void>;
  createFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;

  // Project operations
  setPackageName: (packageName: string) => void;
  setProjectName: (name: string) => void;
  createNewProject: () => Promise<void>;

  // Chat operations
  addChatMessage: (message: ChatMessage) => void;
  messages: ChatMessage[];

  // Export/Import
  exportAndBuild: () => Promise<{ owner: string; repo: string } | null>;
  exportProjectAsZip: () => Promise<void>;
  importProjectFromZip: () => Promise<void>;

  // GitHub operations
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
}
