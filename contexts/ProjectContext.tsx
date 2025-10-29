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
}

const PROJECT_STORAGE_KEY = 'k1w1_current_project_v4';
const CACHE_DIR = FileSystem.cacheDirectory + 'unzipped_p/';
const SAVE_DEBOUNCE_MS = 500;

const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);

const createNewProject = (name = 'Neues Projekt'): ProjectData => ({
  id: uuidv4(),
  name,
  files: [],
  messages: [],
  lastModified: Date.now(),
});

const loadTemplateFromFile = async (): Promise<ProjectFile[]> => {
  try {
    const template = require('../templates/expo-sdk54-base.json');
    if (!Array.isArray(template) || template.length === 0) {
      throw new Error('Template ist ungültig');
    }
    const sanitized = template.map((file) => ({
      ...file,
      content:
        typeof file.content === 'string'
          ? file.content
          : JSON.stringify(file.content ?? '', null, 2),
    }));
    console.log(`✅ Template: ${sanitized.length} Dateien`);
    return sanitized as ProjectFile[];
  } catch (error) {
    console.error('❌ Template Fehler:', error);
    return [{ path: 'README.md', content: '# Template Fehler\n\nApp neu starten.' }];
  }
};

const tryParseJsonContent = (content: string | object): any | null => {
  if (typeof content !== 'string') return content;
  const jsonString = content.trim();
  if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) return null;

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    try {
      const repaired = jsonrepair(jsonString);
      const result = JSON.parse(repaired);
      console.log('✅ JSON mit jsonrepair repariert');
      return result;
    } catch (error) {
      console.error('❌ JSON Parse fehlgeschlagen (auch mit jsonrepair):', error);
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
    if (appCfgFile?.content && typeof appCfgFile.content === 'string') {
      const nameMatch = appCfgFile.content.match(/name:\s*["'](.*?)["']/);
      if (nameMatch?.[1]?.trim()) return nameMatch[1].trim();
      const slugMatch = appCfgFile.content.match(/slug:\s*["'](.*?)["']/);
      if (slugMatch?.[1]?.trim()) return slugMatch[1].trim();
      const cfg = tryParseJsonContent(appCfgFile.content);
      if (cfg?.expo?.name && typeof cfg.expo.name === 'string' && cfg.expo.name.trim()) {
        return cfg.expo.name.trim();
      }
      if (cfg?.expo?.slug && typeof cfg.expo.slug === 'string' && cfg.expo.slug.trim()) {
        return cfg.expo.slug.trim();
      }
    }
  } catch (error) {
    console.error('❌ extractProjectName Fehler:', error);
  }
  return fallback;
};

const normalizeFileContent = (content: any): string => {
  return typeof content === 'string'
    ? content
    : JSON.stringify(content ?? '', null, 2);
};

const readDirectoryRecursive = async (
  dirUri: string,
  basePath = ''
): Promise<ProjectFile[]> => {
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
          const content = await FileSystem.readAsStringAsync(itemUri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          files.push({ path: relativePath, content });
        } catch (error) {
          console.warn(`⚠️ Konnte nicht lesen: ${relativePath}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Verzeichnis-Fehler ${dirUri}:`, error);
  }
  return files;
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const isInitialMount = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadProjectFromStorage = useCallback(async () => {
    console.log('📂 Lade Projekt...');
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
        console.log(`✅ Projekt "${loadedData.name}" geladen (${loadedData.files.length} Dateien)`);
      } else {
        console.log('ℹ️ Kein Projekt, lade Template...');
        const templateFiles = await loadTemplateFromFile();
        loadedData = createNewProject('Expo Template');
        loadedData.files = templateFiles;
      }
    } catch (error) {
      console.error('❌ Ladefehler:', error);
      await AsyncStorage.removeItem(PROJECT_STORAGE_KEY);
      const templateFiles = await loadTemplateFromFile();
      loadedData = createNewProject('Wiederhergestellt');
      loadedData.files = templateFiles;
    } finally {
      setProjectData(loadedData);
      setIsLoading(false);
      console.log('✅ Laden abgeschlossen');
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

    console.log(`💾 Speichere "${projectData.name}"... (Debounced)`);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const dataToSave = {
          ...projectData,
          files: projectData.files.map((file) => ({
            ...file,
            content: normalizeFileContent(file.content),
          })),
        };
        await AsyncStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(dataToSave));
        console.log(`✅ Gespeichert (${dataToSave.files.length} Dateien)`);
      } catch (error) {
        console.error('❌ Speicherfehler:', error);
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
        console.warn('⚠️ updateProjectFiles: Keine validen Dateien zum Mergen.');
        return;
      }

      setProjectData((prevData) => {
        if (!prevData) {
          console.error('❌ updateProjectFiles: Kein Projekt geladen (prevData is null).');
          return null;
        }

        console.log(`🔄 Merge v3: ${validFiles.length} Updates mit ${prevData.files.length} Dateien.`);

        const fileMap = new Map<string, ProjectFile>(
          prevData.files.map((file) => [file.path, file])
        );

        let hasChanges = false;
        const newFilesList: string[] = [];
        const updatedFilesList: string[] = [];

        validFiles.forEach((updatedFile) => {
          const existingFile = fileMap.get(updatedFile.path);

          if (!existingFile) {
            newFilesList.push(updatedFile.path);
            fileMap.set(updatedFile.path, updatedFile);
            console.log(`✨ Neu: ${updatedFile.path}`);
            hasChanges = true;
          } else {
            if (existingFile.content !== updatedFile.content) {
              updatedFilesList.push(updatedFile.path);
              fileMap.set(updatedFile.path, updatedFile);
              console.log(`📝 Update: ${updatedFile.path}`);
              hasChanges = true;
            }
          }
        });

        const finalFiles = Array.from(fileMap.values());

        let finalName = prevData.name;
        if (newName && newName.trim()) {
          finalName = newName.trim();
        }

        const nameChanged = finalName !== prevData.name;
        if (nameChanged) hasChanges = true;

        if (newFilesList.length > 0) {
          console.log(`🎉 NEUE DATEIEN (${newFilesList.length}): ${newFilesList.join(', ')}`);
        }
        if (updatedFilesList.length > 0) {
          console.log(
            `📝 GEÄNDERTE DATEIEN (${updatedFilesList.length}): ${updatedFilesList.join(', ')}`
          );
        }
        if (nameChanged) {
          console.log(`📛 NAME GEÄNDERT: "${prevData.name}" → "${finalName}"`);
        }

        if (!hasChanges) {
          console.log('ℹ️ Merge v3: Keine Änderungen erkannt.');
          // ✅ FIX: Gib trotzdem neues Objekt zurück für useMemo-Update
          return {
            ...prevData,
            lastModified: Date.now(),
          };
        }

        console.log(`✅ Merge v3 abgeschlossen: ${finalFiles.length} Dateien, Name: "${finalName}"`);

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
      console.log(`💬 updateMessages: ${newMessages.length} Nachrichten`);
      return { ...prevData, messages: newMessages, lastModified: Date.now() };
    });
  }, []);

  const clearProject = useCallback(async () => {
    console.log('🗑️ Lösche aktuelles Projekt, lade Template...');
    setIsLoading(true);
    try {
      const templateFiles = await loadTemplateFromFile();
      const newProject = createNewProject('Neues Projekt');
      newProject.files = templateFiles;
      setProjectData(newProject);
      console.log('✅ Neues Projekt nach Clear erstellt');
    } catch (error) {
      console.error('❌ Clear-Fehler:', error);
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
    if (!trimmedName) {
      console.warn('⚠️ setProjectName: Ungültiger Name.');
      return;
    }
    setProjectData((prevData) => {
      if (!prevData || prevData.name === trimmedName) return prevData;
      console.log(`📝 Name: "${prevData.name}" → "${trimmedName}"`);
      return { ...prevData, name: trimmedName, lastModified: Date.now() };
    });
  }, []);

  const loadProjectFromZip = useCallback(async () => {
    console.log('📦 ZIP-Import...');
    setIsLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        console.log('ℹ️ Import abgebrochen');
        return;
      }
      const zipAsset = result.assets[0];

      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });

      console.log('📂 Entpacke...');
      await unzip(zipAsset.uri, CACHE_DIR);

      const newFiles = await readDirectoryRecursive(CACHE_DIR);
      if (newFiles.length === 0) throw new Error('ZIP enthält keine Dateien');

      const newName = extractProjectName(newFiles) || zipAsset.name.replace(/\.zip$/i, '') || 'Import';

      const newProject: ProjectData = {
        id: uuidv4(),
        name: newName,
        files: newFiles,
        messages: [],
        lastModified: Date.now(),
      };
      setProjectData(newProject);
      Alert.alert('Import erfolgreich', `Projekt "${newName}" (${newFiles.length} Dateien)`);
      console.log(`✅ Import: ${newFiles.length} Dateien`);
    } catch (error: any) {
      console.error('❌ Import-Fehler:', error);
      Alert.alert('Import fehlgeschlagen', error.message || 'Fehler');
    } finally {
      setIsLoading(false);
      try {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup-Fehler:', cleanupError);
      }
    }
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
