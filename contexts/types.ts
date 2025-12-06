// contexts/types.ts - vereinheitlicht + Builder-Context für Rich Messages

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ContextFileChange {
  path: string;
  type: 'created' | 'updated' | 'deleted';
  preview?: string;
}

export interface BuilderContextData {
  provider?: string;
  model?: string;
  duration?: number; // in ms

  // Neue Struktur (optional) für Rich-Context
  files?: ProjectFile[];
  changes?: ContextFileChange[];

  // Legacy-Feld (ältere Builder-Versionen)
  filesChanged?: ContextFileChange[];

  totalLines?: number;
  keysRotated?: number;

  // 🔥 Neue Felder für Rich-Context
  summary?: string;        // Kurzbeschreibung des Builds
  quality?: string;        // z.B. 'speed' | 'quality'
  messageCount?: number;   // Anzahl der Prompt-Messages
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  meta?: {
    provider?: string;
    error?: boolean;
    context?: BuilderContextData;
  };
}

export interface ProjectData {
  id?: string;
  name: string;
  slug?: string;
  description?: string;

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
  updateFileContent: (path: string, content: string) => Promise<void>;
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
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface AIContextProps {
  provider: string;
  apiKey: string;
  projectName: string;
  packageName: string;

  isConfigLoaded: boolean;
  isSaving: boolean;

  keysRotated?: number;
  timing?: {
    startMs?: number;
    endMs?: number;
    durationMs?: number;
  };

  setProvider: (provider: string) => void;
  setApiKey: (apiKey: string) => void;
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
  setGitHubToken: (token: string) => Promise<void>;
  clearGitHubToken: () => Promise<void>;
  exportProjectToGitHub: () => Promise<{ owner: string; repo: string } | null>;
}
