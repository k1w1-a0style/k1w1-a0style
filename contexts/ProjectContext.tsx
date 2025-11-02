import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { unzip } from 'react-native-zip-archive';
import { jsonrepair } from 'jsonrepair';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer'; 

export type ProjectFile = {
  path: string;
  content: string;
};

export interface ChatMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: {
    _id: number;
    name: string;
  };
  isStreaming?: boolean;
}

export type ProjectData = {
  id: string;
  name: string;
  files: ProjectFile[];
  messages: ChatMessage[];
  lastModified: number;
};

interface ProjectContextProps {
  projectData: ProjectData | null;
  isLoading: boolean;
  updateProjectFiles: (files: ProjectFile[], newName?: string) => Promise<void>;
  updateProject: (files: ProjectFile[], newName?: string) => Promise<void>;
  updateMessages: (messages: ChatMessage[]) => Promise<void>;
  clearProject: () => Promise<void>;
  loadProjectFromZip: () => Promise<void>;
  setProjectName: (newName: string) => Promise<void>;
  deleteCurrentProject: () => Promise<void>;
  deleteProject: () => Promise<void>;
  messages: ChatMessage[];
  
  exportAndBuild: (project: ProjectData) => Promise<{ owner: string, repo: string } | null>;
  getGitHubToken: () => Promise<string | null>;
  getWorkflowRuns: (owner: string, repo: string, workflowFileName?: string) => Promise<any>;

  createFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  setPackageName: (newPackageName: string) => Promise<void>;
}

const PROJECT_STORAGE_KEY = 'k1w1_current_project_v4';
const CACHE_DIR = FileSystem.cacheDirectory + 'unzipped_p/';
const SAVE_DEBOUNCE_MS = 500;

const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);

// ===================================================================
// SECURESTORE & GITHUB HELPERS
// ===================================================================

const GH_TOKEN_KEY = 'github_pat_v1';
const EXPO_TOKEN_KEY = 'expo_token_v1';

export const saveGitHubToken = async (token: string) => {
  await SecureStore.setItemAsync(GH_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
  });
};
export const getGitHubToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(GH_TOKEN_KEY);
};
export const saveExpoToken = async (token: string) => {
  await SecureStore.setItemAsync(EXPO_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
  });
};
export const getExpoToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(EXPO_TOKEN_KEY);
};

// B) GitHub: Repo erstellen (KORRIGIERT FÜR STATUS 422)
const createRepo = async (repoName: string, isPrivate = true) => {
  const token = await getGitHubToken();
  if (!token) throw new Error('GitHub token fehlt. Bitte in Einstellungen eintragen.');
  
  const resp = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: repoName, private: isPrivate }),
  });
  
  let json: any;
  try {
    json = await resp.json();
  } catch (e) {
    const textResponse = await resp.text();
    throw new Error(`GitHub API Fehler (Status ${resp.status}): Kein JSON empfangen. Antwort: ${textResponse}`);
  }
  
  if (!resp.ok) {
    // KORREKTUR: Fange den "Repo existiert bereits"-Fehler (Status 422) ab
    const alreadyExistsError = json.errors?.find((e: any) => 
      e.message?.includes('name already exists')
    );
    
    if (resp.status === 422 && alreadyExistsError) {
      console.warn(`Repo '${repoName}' existiert bereits, verwende es.`);
      try {
        const userResp = await fetch('https://api.github.com/user', {
          headers: { Authorization: `token ${token}` },
        });
        const userData = await userResp.json();
        if (!userData.login) throw new Error('Konnte User-Login nicht abrufen.');
        
        return { owner: { login: userData.login }, name: repoName, html_url: `https://github.com/${userData.login}/${repoName}` };
      } catch (userError: any) {
        throw new Error(`Repo existiert, aber Owner konnte nicht abgerufen werden: ${userError.message}`);
      }
    }
    
    const errorDetails = JSON.stringify(json, null, 2);
    console.error('GitHub API Fehlerdetails:', errorDetails);
    throw new Error(`GitHub API Fehler (Status ${resp.status}): ${json.message || errorDetails}`);
  }
  
  return json; // Erfolgreiche Erstellung
};

// C) GitHub: Datei anlegen/update (Contents API)
const createOrUpdateFile = async (owner: string, repo: string, path: string, content: string, message = 'Add file') => {
  const token = await getGitHubToken();
  if (!token) throw new Error('GitHub token fehlt.');
  const getResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    headers: { Authorization: `token ${token}` },
  });
  let sha: string | undefined = undefined;
  if (getResp.ok) {
    const existing = await getResp.json();
    sha = existing.sha;
  }
  const body: any = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'), 
    branch: 'main',
  };
  if (sha) body.sha = sha;
  const putResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await putResp.json();
  if (!putResp.ok) throw new Error(json.message || `create/update file failed: ${path}`);
  return json;
};

// D) Push alle Dateien (sequenziell)
const pushFilesToRepo = async (owner: string, repo: string, files: ProjectFile[]) => {
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sortedFiles) {
    if (!f.path) continue; 
    console.log(`Pushing ${f.path}...`);
    await createOrUpdateFile(owner, repo, f.path, f.content, `Add ${f.path}`);
  }
};

// E) Workflow triggern
const triggerWorkflow = async (owner: string, repo: string, workflowFileName = 'eas-build.yml', ref = 'main', inputs = {}) => {
  const token = await getGitHubToken();
  if (!token) throw new Error('GitHub token fehlt.');
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/dispatches`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, inputs }),
  });
  if (resp.status === 204) return { started: true };
  if (resp.status === 404) {
      throw new Error(`Workflow nicht gefunden. Stelle sicher, dass '${workflowFileName}' im '.github/workflows' Ordner auf GitHub (Branch 'main') existiert.`);
  }
  const json = await resp.json();
  throw new Error(json.message || 'workflow dispatch failed');
};

// H) Polling Build Status (simple)
const getWorkflowRuns = async (owner: string, repo: string, workflowFileName = 'eas-build.yml') => {
  const token = await getGitHubToken();
  if (!token) throw new Error('GitHub token fehlt.');
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/runs?per_page=5`;
  const resp = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.message || 'get runs failed');
  return json; 
};

// ===================================================================
// KERNLOGIK
// ===================================================================
// ... (createNewProject, loadTemplateFromFile, tryParseJsonContent, extractProjectName, normalizeFileContent, readDirectoryRecursive bleiben gleich) ...
const createNewProject = (name = 'Neues Projekt'): ProjectData => ({
  id: uuidv4(), name, files: [], messages: [], lastModified: Date.now(),
});

const loadTemplateFromFile = async (): Promise<ProjectFile[]> => {
  try {
    const template = require('../templates/expo-sdk54-base.json');
    if (!Array.isArray(template) || template.length === 0) {
      throw new Error('Template ist ungültig');
    }
    const sanitized = template.map((file) => ({
      ...file,
      content: typeof file.content === 'string' ? file.content : JSON.stringify(file.content ?? '', null, 2),
    }));
    console.log(`  Template: ${sanitized.length} Dateien`);
    return sanitized as ProjectFile[];
  } catch (error) {
    console.error('X Template Fehler:', error);
    return [{ path: 'README.md', content: '# Template Fehler\n\nApp neu starten.' }];
  }
};

const tryParseJsonContent = (content: string | object): any | null => {
  if (typeof content !== 'string') return content;
  const jsonString = content.trim();
  if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) return null;
  try { return JSON.parse(jsonString); } catch (e) {
    try {
      const repaired = jsonrepair(jsonString);
      const result = JSON.parse(repaired);
      console.log(' JSON mit jsonrepair repariert');
      return result;
    } catch (error) {
      console.error('X JSON Parse fehlgeschlagen (auch mit jsonrepair):', error);
      return null;
    }
  }
};

const extractProjectName = (files: ProjectFile[]): string => {
  const fallback = 'Unbenanntes Projekt';
  try {
    const pkgFile = files.find((f) => f.path === 'package.json');
    if (pkgFile?.content) {
      const pkg = tryParseJsonContent(pkgFile.content);
      if (pkg?.name && typeof pkg.name === 'string' && pkg.name.trim()) {
        return pkg.name.trim();
      }
    }
    const appCfgFile = files.find((f) => f.path === 'app.config.js' || f.path === 'app.json');
    if (appCfgFile?.content) {
        const cfg = tryParseJsonContent(appCfgFile.content);
        if (cfg?.expo?.name && typeof cfg.expo.name === 'string' && cfg.expo.name.trim()) {
            return cfg.expo.name.trim();
        }
        if (cfg?.expo?.slug && typeof cfg.expo.slug === 'string' && cfg.expo.slug.trim()) {
            return cfg.expo.slug.trim();
        }
    }
  } catch (error) {
    console.error(' extractProjectName Fehler:', error);
  }
  return fallback;
};

const normalizeFileContent = (content: any): string => {
  return typeof content === 'string' ? content : JSON.stringify(content ?? '', null, 2);
};

const readDirectoryRecursive = async (dirUri: string, basePath = ''): Promise<ProjectFile[]> => {
  let files: ProjectFile[] = [];
  try {
    const items = await FileSystem.readDirectoryAsync(dirUri);
    for (const item of items) {
      const itemUri = `${dirUri}${item}`;
      const info = await FileSystem.getInfoAsync(itemUri);
      const relativePath = basePath ? `${basePath}/${item}` : item;
      if (info.isDirectory) {
        files = files.concat(await readDirectoryRecursive(itemUri + '/', relativePath));
      } else {
        try {
          const content = await FileSystem.readAsStringAsync(itemUri, { encoding: FileSystem.EncodingType.UTF8 });
          files.push({ path: relativePath, content });
        } catch (error) {
          console.warn(` Konnte nicht lesen: ${relativePath}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`X Verzeichnis-Fehler ${dirUri}: `, error);
  }
  return files;
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const isInitialMount = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadProjectFromStorage = useCallback(async () => {
    console.log(' Lade Projekt...');
    setIsLoading(true);
    isInitialMount.current = true;
    let loadedData: ProjectData | null = null;
    try {
      const jsonValue = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
      if (jsonValue) {
        const parsed = tryParseJsonContent(jsonValue);
        if (!parsed || typeof parsed !== 'object' || !parsed.id) {
          throw new Error('Gespeichertes Projekt ist ungültig');
        }
        loadedData = parsed as ProjectData;
        loadedData.messages = loadedData.messages || [];
        loadedData.id = loadedData.id || uuidv4();
        loadedData.files = (loadedData.files || []).map((file) => ({
          path: file.path || 'unbekannte_datei',
          content: normalizeFileContent(file.content),
        }));
        console.log(
          `  Projekt "${loadedData.name}" geladen (${loadedData.files.length} Dateien)`
        );
      } else {
        console.log(' Kein Projekt, lade Template...');
        const templateFiles = await loadTemplateFromFile();
        loadedData = createNewProject('Expo Template');
        loadedData.files = templateFiles;
      }
    } catch (error) {
      console.error('X Ladefehler:', error);
      await AsyncStorage.removeItem(PROJECT_STORAGE_KEY);
      const templateFiles = await loadTemplateFromFile();
      loadedData = createNewProject('Wiederhergestellt');
      loadedData.files = templateFiles;
    } finally {
      setProjectData(loadedData);
      setIsLoading(false);
      console.log(' Laden abgeschlossen');
      requestAnimationFrame(() => {
        isInitialMount.current = false;
      });
    }
  }, []);

  useEffect(() => {
    loadProjectFromStorage();
  }, [loadProjectFromStorage]);

  useEffect(() => {
    if (isInitialMount.current || !projectData || isLoading) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      try {
        if (!projectData) return;
        console.log(` Speichere "${projectData.name}"... (Debounced)`);
        const dataToSave = {
          ...projectData,
          files: projectData.files.map((file) => ({
            ...file,
            content: normalizeFileContent(file.content),
          })),
        };
        await AsyncStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(dataToSave));
        console.log(`  Gespeichert (${dataToSave.files.length} Dateien)`);
      } catch (error) {
        console.error('Speicherfehler:', error);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectData, isLoading]);

  const updateProjectFiles = useCallback(
    async (newOrUpdatedFiles: ProjectFile[], newName?: string) => {
      const validFiles = (newOrUpdatedFiles || [])
        .filter((f) => f?.path && typeof f.path === 'string')
        .map((f) => ({
          path: f.path,
          content: normalizeFileContent(f.content),
        }));
      if (!validFiles.length) {
        console.warn('! updateProjectFiles: Keine validen Dateien zum Mergen.');
        return;
      }
      setProjectData((prevData) => {
        if (!prevData) {
          console.error('X updateProjectFiles: Kein Projekt geladen (prevData is null).');
          return null;
        }
        const fileMap = new Map<string, ProjectFile>(
          prevData.files.map((file) => [file.path, file])
        );
        let hasChanges = false;
        validFiles.forEach((updatedFile) => {
          const existingFile = fileMap.get(updatedFile.path);
          if (!existingFile || existingFile.content !== updatedFile.content) {
            fileMap.set(updatedFile.path, updatedFile);
            hasChanges = true;
          }
        });
        const finalFiles = Array.from(fileMap.values());
        let finalName = prevData.name;
        if (newName && newName.trim()) {
          finalName = newName.trim();
        }
        const nameChanged = finalName !== prevData.name;
        if (nameChanged) hasChanges = true;
        if (!hasChanges) {
          return { ...prevData, lastModified: Date.now() };
        }
        return {
          ...prevData,
          name: finalName,
          files: finalFiles,
          lastModified: Date.now(),
        };
      });
    },
    []
  );

  const updateMessages = useCallback(async (newMessages: ChatMessage[]) => {
    setProjectData((prevData) => {
      if (!prevData) return null;
      return { ...prevData, messages: newMessages, lastModified: Date.now() };
    });
  }, []);

  const clearProject = useCallback(async () => {
    setIsLoading(true);
    try {
      const templateFiles = await loadTemplateFromFile();
      const newProject = createNewProject('Neues Projekt');
      newProject.files = templateFiles;
      setProjectData(newProject);
    } catch (error) {
      Alert.alert('Fehler', 'Konnte Projekt nicht zurücksetzen.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteCurrentProject = useCallback(async () => {
    if (!projectData) return;
    Alert.alert(
      `Projekt "${projectData.name}" löschen?`,
      'Ein neues Template-Projekt wird erstellt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: clearProject },
      ]
    );
  }, [projectData, clearProject]);

  const setProjectName = useCallback(async (newName: string) => {
    const trimmedName = newName?.trim();
    if (!trimmedName) return;
    setProjectData((prevData) => {
      if (!prevData || prevData.name === trimmedName) return prevData;
      return { ...prevData, name: trimmedName, lastModified: Date.now() };
    });
  }, []);

  const loadProjectFromZip = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setIsLoading(false); return;
      }
      const zipAsset = result.assets[0];
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      await unzip(zipAsset.uri, CACHE_DIR);
      const newFiles = await readDirectoryRecursive(CACHE_DIR);
      if (newFiles.length === 0) throw new Error('ZIP enthält keine Dateien');
      const newName = extractProjectName(newFiles) || zipAsset.name.replace(/\.zip$/i, '') || 'Import';
      setProjectData({
        id: uuidv4(), name: newName, files: newFiles, messages: [], lastModified: Date.now(),
      });
      Alert.alert('Import erfolgreich', `Projekt "${newName}" (${newFiles.length} Dateien)`);
    } catch (error: any) {
      Alert.alert('Import fehlgeschlagen', error.message || 'Fehler');
    } finally {
      setIsLoading(false);
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }).catch(() => {});
    }
  }, []);
  
  const exportAndBuild = useCallback(async (project: ProjectData) => {
    try {
      // === KORREKTUR: REPO-NAME ===
      // Entferne die ID, um den "fuck namen" zu beheben.
      const repoName = project.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      // ============================
      
      console.log(`Versuche, Repo '${repoName}' zu erstellen...`);
      const repoInfo = await createRepo(repoName, true); // (Diese Funktion ist jetzt robust)
      const owner = repoInfo.owner.login;
      const repo = repoInfo.name;
      
      const workflowPath = '.github/workflows/eas-build.yml';
      let filesToPush = [...project.files];
      if (!filesToPush.some(f => f.path === workflowPath)) {
          const templateFiles = await loadTemplateFromFile();
          const workflowFile = templateFiles.find(f => f.path === workflowPath);
          if (!workflowFile) {
              Alert.alert(
                "Fehlende Workflow-Datei",
                `Das Projekt enthält nicht die erforderliche '${workflowPath}'.\n\nStelle sicher, dass 'templates/expo-sdk54-base.json' diese Datei enthält.`
              );
              return null;
          }
          filesToPush.push(workflowFile);
          console.log("Workflow-Datei wurde automatisch zum Push hinzugefügt.");
      }
      console.log(`Pushe ${filesToPush.length} Dateien zu ${owner}/${repo}...`);
      await pushFilesToRepo(owner, repo, filesToPush);
      Alert.alert(
        'Repo erstellt & Code gepusht', 
        `Repo: ${owner}/${repo}.\n\nNÄCHSTER SCHRITT (WICHTIG):\nGehe zu GitHub, öffne das Repo -> Settings -> Secrets and variables -> Actions -> 'New repository secret'.\n\nName: EXPO_TOKEN\nWert: (Dein Expo Token)`
      );
      const REAL_WORKFLOW_FILE_NAME = 'eas-build.yml';
      console.log(`Triggere Workflow: ${REAL_WORKFLOW_FILE_NAME}...`);
      await triggerWorkflow(owner, repo, REAL_WORKFLOW_FILE_NAME, 'main');
      Alert.alert('Build gestartet', 'GitHub Actions wurde getriggert. Du kannst den Status im Header pollen.');
      return { owner, repo };
    } catch (e: any) {
      console.error('exportAndBuild error', e);
      Alert.alert('Build-Fehler', e.message || String(e));
      throw e;
    }
  }, []);

  const createFile = useCallback(async (path: string, content: string) => {
    setProjectData((prevData) => {
      if (!prevData) return null;
      if (prevData.files.some(f => f.path === path)) {
        Alert.alert("Fehler", "Eine Datei mit diesem Pfad existiert bereits.");
        return prevData;
      }
      const newFile: ProjectFile = { path, content };
      return {
        ...prevData,
        files: [...prevData.files, newFile],
        lastModified: Date.now(),
      };
    });
  }, []);

  const deleteFile = useCallback(async (path: string) => {
    setProjectData((prevData) => {
      if (!prevData) return null;
      return {
        ...prevData,
        files: prevData.files.filter(f => f.path !== path),
        lastModified: Date.now(),
      };
    });
  }, []);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    setProjectData((prevData) => {
      if (!prevData) return null;
      if (prevData.files.some(f => f.path === newPath)) {
        Alert.alert("Fehler", "Eine Datei mit dem neuen Pfad existiert bereits.");
        return prevData;
      }
      return {
        ...prevData,
        files: prevData.files.map(f => f.path === oldPath ? { ...f, path: newPath } : f),
        lastModified: Date.now(),
      };
    });
  }, []);

  const setPackageName = useCallback(async (newPackageName: string) => {
    const slug = newPackageName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const bundleIdName = slug.replace(/-/g, '');
    const androidPackage = `com.${bundleIdName}`;
    const iosBundle = `com.${bundleIdName}`;
    setProjectData((prevData) => {
        if (!prevData) return null;
        const newFiles = prevData.files.map(file => {
            let content = file.content;
            try {
                if (file.path === 'package.json') {
                    const pkg = JSON.parse(content);
                    pkg.name = slug;
                    content = JSON.stringify(pkg, null, 2);
                }
                if (file.path === 'app.config.js') {
                    if (typeof content === 'string') {
                        content = content.replace(/(slug:\s*["']).*?(["'])/, `$1${slug}$2`);
                        content = content.replace(/(package:\s*["']).*?(["'])/, `$1${androidPackage}$2`);
                        content = content.replace(/(bundleIdentifier:\s*["']).*?(["'])/, `$1${iosBundle}$2`);
                    }
                }
            } catch (e) {
                console.error(`Fehler beim Aktualisieren von ${file.path}:`, e);
                return file;
            }
            return { ...file, content };
        });
        return {
            ...prevData,
            files: newFiles,
            lastModified: Date.now(),
        };
    });
    Alert.alert('Package Name aktualisiert', `Slug: ${slug}\nAndroid: ${androidPackage}\niOS: ${iosBundle}`);
  }, []);


  const value: ProjectContextProps = {
    projectData,
    isLoading,
    updateProjectFiles,
    updateProject: updateProjectFiles,
    updateMessages,
    clearProject,
    loadProjectFromZip,
    setProjectName,
    deleteCurrentProject,
    deleteProject: deleteCurrentProject,
    messages: projectData?.messages || [],
    exportAndBuild,
    getGitHubToken,
    getWorkflowRuns,
    createFile,
    deleteFile,
    renameFile,
    setPackageName,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export const useProject = (): ProjectContextProps => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject muss innerhalb eines ProjectProvider verwendet werden');
  }
  return context;
};

