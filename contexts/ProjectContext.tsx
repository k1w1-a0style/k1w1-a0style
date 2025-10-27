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
import 'react-native-get-random-values'; // Für uuid
import { v4 as uuidv4 } from 'uuid';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { unzip } from 'react-native-zip-archive';
import { jsonrepair } from 'jsonrepair'; // ✅ NEU: Robuster JSON-Reparatur-Parser

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ProjectFile = {
  path: string; // Relativer Pfad, z.B. "src/components/Button.tsx"
  content: string; // Dateiinhalt IMMER als String speichern/verarbeiten
};

export interface ChatMessage {
  _id: string; // Eindeutige ID der Nachricht
  text: string; // Inhalt der Nachricht
  createdAt: Date; // Zeitstempel
  user: {
    _id: number; // 1 for user, 2 for AI
    name: string; // 'User' or 'AI'
  };
  isStreaming?: boolean; // Optional für spätere Streaming-Anzeige
}

export type ProjectData = {
  id: string; // Eindeutige ID des Projekts
  name: string; // Anzeigename des Projekts
  files: ProjectFile[]; // Array aller Dateien im Projekt
  messages: ChatMessage[]; // Chatverlauf für dieses Projekt
  lastModified: number; // Zeitstempel der letzten Änderung (Date.now())
};

// Definition der Werte und Funktionen, die der Context bereitstellt
interface ProjectContextProps {
  projectData: ProjectData | null; // Aktuell geladenes Projekt oder null
  isLoading: boolean; // Zeigt an, ob gerade geladen/gespeichert wird
  updateProjectFiles: (
    files: ProjectFile[],
    newName?: string
  ) => Promise<void>; // Aktualisiert Dateien (mit Merge!)
  updateProject: (files: ProjectFile[], newName?: string) => Promise<void>; // Alias
  updateMessages: (messages: ChatMessage[]) => Promise<void>; // Aktualisiert nur Chat
  clearProject: () => Promise<void>; // Setzt auf leeres Template zurück
  loadProjectFromZip: () => Promise<void>; // Importiert aus ZIP
  setProjectName: (newName: string) => Promise<void>; // Ändert nur den Namen
  deleteCurrentProject: () => Promise<void>; // Löscht (setzt zurück) mit Bestätigung
  deleteProject: () => Promise<void>; // Alias
  messages: ChatMessage[]; // Bequemer Zugriff auf aktuelle Nachrichten
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROJECT_STORAGE_KEY = 'k1w1_current_project_v4'; // Key für AsyncStorage
const CACHE_DIR = FileSystem.cacheDirectory + 'unzipped_p/'; // Temp-Ordner für ZIP-Import
const SAVE_DEBOUNCE_MS = 500; // Verzögerung für Auto-Save in Millisekunden

// ============================================================================
// CONTEXT
// ============================================================================

const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Erstellt ein neues leeres Projekt-Objekt.
 */
const createNewProject = (name = 'Neues Projekt'): ProjectData => ({
  id: uuidv4(),
  name,
  files: [],
  messages: [],
  lastModified: Date.now(),
});

/**
 * Lädt das Basis-Template aus der eingebetteten JSON-Datei.
 */
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

/**
 * Versucht robust, einen String als JSON zu parsen. Nutzt jsonrepair.
 */
const tryParseJsonContent = (content: string | object): any | null => {
  if (typeof content !== 'string') return content;
  const jsonString = content.trim();
  if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) return null;

  try { // Standard-Parse
    return JSON.parse(jsonString);
  } catch (e) { // Fallback mit jsonrepair
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

/**
 * Extrahiert den Projektnamen aus package.json oder app.config.
 */
const extractProjectName = (files: ProjectFile[]): string => {
  const fallback = 'Unbenanntes Projekt';
  try {
    // package.json
    const pkgFile = files.find((f) => f.path === 'package.json');
    if (pkgFile?.content) {
      const pkg = tryParseJsonContent(pkgFile.content);
      if (pkg?.name && typeof pkg.name === 'string' && pkg.name.trim()) {
        return pkg.name.trim();
      }
    }
    // app.config.js/json
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

/**
 * Stellt sicher, dass der Dateiinhalt immer ein String ist.
 */
const normalizeFileContent = (content: any): string => {
  return typeof content === 'string'
    ? content
    : JSON.stringify(content ?? '', null, 2);
};

/**
 * Liest rekursiv alle Dateien aus einem lokalen Verzeichnis.
 */
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

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================
export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const isInitialMount = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null); // Für Debounce Cleanup

  // --------------------------------------------------------------------------
  // LOAD FROM STORAGE
  // --------------------------------------------------------------------------
  const loadProjectFromStorage = useCallback(async () => {
    console.log('📂 Lade Projekt...');
    setIsLoading(true);
    isInitialMount.current = true;
    let loadedData: ProjectData | null = null;
    try {
      const jsonValue = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
      if (jsonValue) {
        // Use tryParseJsonContent for loading as well, in case stored data is slightly corrupt
        const parsed = tryParseJsonContent(jsonValue);
        if (!parsed || typeof parsed !== 'object' || !parsed.id) { // Basic validation
             throw new Error('Gespeichertes Projekt ist ungültig');
        }
        loadedData = parsed as ProjectData;
        // Normalize loaded data
        loadedData.messages = loadedData.messages || [];
        loadedData.id = loadedData.id || uuidv4(); // Should exist from parse check
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
        requestAnimationFrame(() => { isInitialMount.current = false; });
    }
  }, []);

  useEffect(() => { loadProjectFromStorage(); }, [loadProjectFromStorage]);

  // --------------------------------------------------------------------------
  // AUTO-SAVE (mit Debounce)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isInitialMount.current || !projectData || isLoading) return;

    console.log(`💾 Speichere "${projectData.name}"... (Debounced)`);

    // Clear previous timer if exists
    if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const dataToSave = {
          ...projectData,
          files: projectData.files.map((file) => ({
            ...file,
            content: normalizeFileContent(file.content), // Ensure content is string
          })),
        };
        await AsyncStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(dataToSave));
        console.log(`✅ Gespeichert (${dataToSave.files.length} Dateien)`);
      } catch (error) {
        console.error('❌ Speicherfehler:', error);
      }
    }, SAVE_DEBOUNCE_MS);

    // Cleanup timer on unmount or before next save
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectData, isLoading]); // Depend on projectData and isLoading

  // --------------------------------------------------------------------------
  // UPDATE FILES (Merge Logic v3 + Change Detection)
  // --------------------------------------------------------------------------
  const updateProjectFiles = useCallback(
    async (newOrUpdatedFiles: ProjectFile[], newName?: string) => {
      // 1. Validate input
      const validFiles = (newOrUpdatedFiles || [])
        .filter(f => f?.path && typeof f.path === 'string') // Ensure path exists and is string
        .map(f => ({
          path: f.path,
          content: normalizeFileContent(f.content), // Ensure content is string
        }));

      if (!validFiles.length) {
        console.warn('⚠️ updateProjectFiles: Keine validen Dateien zum Mergen.');
        return;
      }

      // 2. Update state using functional update
      setProjectData(prevData => {
        if (!prevData) {
          console.error('❌ updateProjectFiles: Kein Projekt geladen (prevData is null).');
          return null;
        }

        console.log(`🔄 Merge v3: ${validFiles.length} Updates mit ${prevData.files.length} Dateien.`);

        // 3. Create map of existing files
        const fileMap = new Map<string, ProjectFile>(
          prevData.files.map(file => [file.path, file])
        );

        // 4. Merge updates into the map
        let hasChanges = false;
        validFiles.forEach(updatedFile => {
          const existingFile = fileMap.get(updatedFile.path);
          const isNew = !existingFile;
          // Check content difference carefully
          const isChanged = existingFile && existingFile.content !== updatedFile.content;

          if (isNew || isChanged) {
            fileMap.set(updatedFile.path, updatedFile); // Add or overwrite
            console.log(`${isNew ? '✨ Neu' : '📝 Update'}: ${updatedFile.path}`);
            hasChanges = true;
          }
        });

        // 5. Determine final name
        const finalFiles = Array.from(fileMap.values());
        const finalName = newName || extractProjectName(finalFiles) || prevData.name;
        const nameChanged = finalName !== prevData.name;
        if (nameChanged) hasChanges = true;

        // 6. Performance Optimization: Only return new object if changes occurred
        if (!hasChanges) {
          console.log('ℹ️ Merge v3: Keine Änderungen erkannt.');
          return prevData; // Return previous state reference
        }

        console.log(`✅ Merge v3 abgeschlossen: ${finalFiles.length} Dateien, Name: "${finalName}"`);

        // 7. Return updated state object
        return {
          ...prevData,
          name: finalName,
          files: finalFiles,
          lastModified: Date.now(),
        };
      });
      // Saving is handled by the useEffect hook
    },
    [] // No dependencies needed for useCallback with functional state updates
  );

  // --------------------------------------------------------------------------
  // UPDATE MESSAGES
  // --------------------------------------------------------------------------
  const updateMessages = useCallback(async (newMessages: ChatMessage[]) => {
    setProjectData(prevData => {
      if (!prevData) return null;
      console.log(`💬 updateMessages: ${newMessages.length} Nachrichten`);
      return { ...prevData, messages: newMessages, lastModified: Date.now() };
    });
  }, []);

  // --------------------------------------------------------------------------
  // CLEAR PROJECT (Reset to Template)
  // --------------------------------------------------------------------------
  const clearProject = useCallback(async () => {
    console.log('🗑️ Lösche aktuelles Projekt, lade Template...');
    setIsLoading(true); // Show loading
    try {
      const templateFiles = await loadTemplateFromFile();
      const newProject = createNewProject('Neues Projekt'); // Consistent naming
      newProject.files = templateFiles;
      setProjectData(newProject); // Update state -> triggers save via useEffect
      console.log('✅ Neues Projekt nach Clear erstellt');
    } catch (error) {
      console.error('❌ Clear-Fehler:', error);
      Alert.alert('Fehler', 'Konnte Projekt nicht zurücksetzen.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // DELETE (mit Bestätigung)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // SET NAME
  // --------------------------------------------------------------------------
  const setProjectName = useCallback(async (newName: string) => {
    const trimmedName = newName?.trim();
    if (!trimmedName) {
      console.warn('⚠️ setProjectName: Ungültiger Name.');
      return;
    }
    setProjectData(prevData => {
      if (!prevData || prevData.name === trimmedName) return prevData; // No change
      console.log(`📝 Name: "${prevData.name}" → "${trimmedName}"`);
      return { ...prevData, name: trimmedName, lastModified: Date.now() };
    });
  }, []);

  // --------------------------------------------------------------------------
  // ZIP IMPORT
  // --------------------------------------------------------------------------
  const loadProjectFromZip = useCallback(async () => {
    console.log('📦 ZIP-Import...');
    setIsLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        console.log('ℹ️ Import abgebrochen'); return; // Exit early
      }
      const zipAsset = result.assets[0];

      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });

      console.log('📂 Entpacke...');
      await unzip(zipAsset.uri, CACHE_DIR);

      const newFiles = await readDirectoryRecursive(CACHE_DIR); // Use helper
      if (newFiles.length === 0) throw new Error('ZIP enthält keine Dateien');

      const newName = extractProjectName(newFiles) || zipAsset.name.replace(/\.zip$/i, '') || 'Import';

      const newProject: ProjectData = {
        id: uuidv4(), name: newName, files: newFiles, messages: [], lastModified: Date.now(),
      };
      setProjectData(newProject); // Update state -> triggers save
      Alert.alert('Import erfolgreich', `Projekt "${newName}" (${newFiles.length} Dateien)`);
      console.log(`✅ Import: ${newFiles.length} Dateien`);
    } catch (error: any) {
      console.error('❌ Import-Fehler:', error);
      Alert.alert('Import fehlgeschlagen', error.message || 'Fehler');
    } finally {
      setIsLoading(false);
      try { await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }); }
      catch (cleanupError) { console.warn('⚠️ Cleanup-Fehler:', cleanupError); }
    }
  }, []); // extractProjectName is stable, no need to list as dependency

  // --------------------------------------------------------------------------
  // CONTEXT VALUE
  // --------------------------------------------------------------------------
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

  return (
    <ProjectContext.Provider value={value}>
        {children}
    </ProjectContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================
export const useProject = (): ProjectContextProps => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject muss innerhalb eines ProjectProvider verwendet werden');
  }
  return context;
};
