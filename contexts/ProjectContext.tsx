import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { unzip } from 'react-native-zip-archive';

export type ProjectFile = {
  path: string;
  content: string | object; // Behalten wir bei, aber intern arbeiten wir meist mit string
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
  updateProject: (files: ProjectFile[], newName?: string) => Promise<void>; // Alias behalten
  updateMessages: (messages: ChatMessage[]) => Promise<void>;
  clearProject: () => Promise<void>;
  loadProjectFromZip: () => Promise<void>;
  setProjectName: (newName: string) => Promise<void>;
  deleteCurrentProject: () => Promise<void>;
  deleteProject: () => Promise<void>; // Alias behalten
  messages: ChatMessage[];
}

const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);

const PROJECT_STORAGE_KEY = 'k1w1_current_project_v4';

// Erstellt ein neues, leeres Projekt-Objekt
const createNewProjectInternal = (name = "Neues Projekt"): ProjectData => ({
  id: uuidv4(),
  name: name,
  files: [],
  messages: [],
  lastModified: Date.now()
});

// Lädt das Basis-Template aus der JSON-Datei
const loadTemplateFromFile = async (): Promise<ProjectFile[]> => {
  try {
    console.log("📦 ProjectContext: Lade Template aus templates/expo-sdk54-base.json...");
    const templateModule = require('../templates/expo-sdk54-base.json');
    if (!Array.isArray(templateModule) || templateModule.length === 0) {
      throw new Error("Template ist leer oder ungültig.");
    }
    // Stelle sicher, dass content immer string ist
    const stringifiedTemplate = templateModule.map(file => ({
        ...file,
        content: typeof file.content === 'string' ? file.content : JSON.stringify(file.content ?? '', null, 2)
    }));
    console.log(`✅ Template geladen: ${stringifiedTemplate.length} Dateien`);
    return stringifiedTemplate as ProjectFile[];
  } catch (error: any) {
    console.error("❌ Template konnte nicht geladen werden:", error);
    return [ { path: "README.md", content: "# Neues Projekt\n\nTemplate Error." } ];
  }
};

// ✅ NEU: Robuster JSON-Parser-Helfer speziell für Datei-Inhalte
const tryParseJsonContent = (content: string | object): any | null => {
    if (typeof content !== 'string') {
        // Wenn es bereits ein Objekt ist, geben wir es zurück (sollte nicht passieren, aber sicher ist sicher)
        return content;
    }
    if (!content.trim().startsWith('{') && !content.trim().startsWith('[')) {
        // Wenn es nicht wie JSON aussieht, ist es wahrscheinlich normaler Code/Text
        return null;
    }

    try {
        // 1. Standard-Versuch
        return JSON.parse(content);
    } catch (e1) {
        // console.warn(`TryParseJson: Standard parse failed - ${e1.message}`); // Optional: Weniger Logging
        try {
            // 2. Versuch mit Bereinigung (ähnlich dirtyJsonParse, aber einfacher)
            let cleaned = content
                .replace(/,\s*([}\]])/g, '$1') // Trailing commas
                .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // Kommentare entfernen
            return JSON.parse(cleaned);
        } catch (e2) {
            // console.error(`❌ TryParseJson: Auch Bereinigung fehlgeschlagen - ${e2.message}`); // Optional: Weniger Logging
            return null; // Konnte nicht als JSON geparst werden
        }
    }
};


export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);

  // Speichert das Projekt-Objekt in AsyncStorage
  const saveProjectToStorage = async (dataToSave: ProjectData | null) => {
    try {
      // Stelle sicher, dass file.content immer ein String ist vor dem Speichern
      const dataWithStringContent = dataToSave ? {
          ...dataToSave,
          files: dataToSave.files.map(f => ({
              ...f,
              content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content ?? '', null, 2)
          }))
      } : null;
      const jsonValue = JSON.stringify(dataWithStringContent);
      await AsyncStorage.setItem(PROJECT_STORAGE_KEY, jsonValue);
      console.log(`Storage gespeichert: ${dataWithStringContent?.name}, ${dataWithStringContent?.files?.length || 0} Dateien`);
    } catch (e) {
      console.error("ProjectContext: Fehler beim Speichern", e);
    }
  };

  // Lädt das Projekt aus AsyncStorage oder erstellt ein neues mit Template
  const loadProjectFromStorage = useCallback(async () => {
    console.log("ProjectContext: Ladevorgang gestartet...");
    let loadedData: ProjectData | null = null;
    let needsSave = false;

    try {
      const jsonValue = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
      if (jsonValue) {
        loadedData = JSON.parse(jsonValue);
        // Migration/Validierung alter Daten
        if (!loadedData) throw new Error("Geparste Daten sind null");
        if (!loadedData.messages) loadedData.messages = [];
        if (!loadedData.id) loadedData.id = uuidv4();
        // Stelle sicher, dass content immer string ist nach dem Laden
        loadedData.files = (loadedData.files || []).map(f => ({
            ...f,
            content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content ?? '', null, 2)
        }));
        console.log(`ProjectContext: Projekt "${loadedData.name}" geladen.`);
      } else {
        console.log("ProjectContext: Kein Projekt. Erstelle mit Template.");
        const templateFiles = await loadTemplateFromFile();
        loadedData = createNewProjectInternal();
        loadedData.files = templateFiles;
        needsSave = true;
      }
    } catch (e) {
      console.error("ProjectContext: Fehler beim Laden/Parsen, erstelle neues Projekt.", e);
      const templateFiles = await loadTemplateFromFile();
      loadedData = createNewProjectInternal("Fehler-Projekt");
      loadedData.files = templateFiles;
      needsSave = true;
      // Optional: Alten, fehlerhaften Eintrag löschen
      await AsyncStorage.removeItem(PROJECT_STORAGE_KEY);
    }

    setProjectData(loadedData);

    if (needsSave) {
      await saveProjectToStorage(loadedData); // Speichere das (neu erstellte) Projekt
    }

    setIsLoading(false);
    console.log("ProjectContext: Ladevorgang abgeschlossen.");
  }, []);

  useEffect(() => {
    loadProjectFromStorage();
  }, [loadProjectFromStorage]);

  // Extrahiert den Projektnamen aus package.json oder app.config.js/app.json
  const extractProjectName = (files: ProjectFile[]): string => {
    let extractedName = "Unbenanntes Projekt";
    try {
      // Versuch aus package.json
      const pkgJsonFile = files.find(f => f.path === 'package.json');
      if (pkgJsonFile?.content) {
        // ✅ NEU: Nutze robusten Parser für den Inhalt
        const pkg = tryParseJsonContent(pkgJsonFile.content);
        if (pkg && pkg.name && typeof pkg.name === 'string' && pkg.name.trim()) {
            console.log(`extractProjectName: Name "${pkg.name.trim()}" aus package.json extrahiert.`);
            return pkg.name.trim();
        } else if (pkg) {
             console.warn("ProjectContext: package.json geparst, aber 'name' fehlt oder ist ungültig.");
        } else {
             // Nur loggen wenn TryParseJson fehlgeschlagen ist
             console.warn("ProjectContext: package.json konnte NICHT geparst werden (selbst mit tryParseJsonContent).");
        }
      }

      // Fallback: Versuch aus app.config.js/app.json
      const appConfigFile = files.find(f => f.path === 'app.config.js' || f.path === 'app.json');
      if (appConfigFile?.content && typeof appConfigFile.content === 'string') {
        // Versuch via Regex (für .js)
        const nameMatchJS = appConfigFile.content.match(/name:\s*["'](.*?)["']/);
        if (nameMatchJS?.[1]?.trim()) {
             console.log(`extractProjectName: Name "${nameMatchJS[1].trim()}" aus app.config.js (Regex) extrahiert.`);
             return nameMatchJS[1].trim();
        }
        const slugMatchJS = appConfigFile.content.match(/slug:\s*["'](.*?)["']/);
        if (slugMatchJS?.[1]?.trim()) {
             console.log(`extractProjectName: Slug "${slugMatchJS[1].trim()}" aus app.config.js (Regex) extrahiert.`);
             return slugMatchJS[1].trim();
        }

        // Versuch via JSON Parse (für .json oder .js-Objekt)
        const appJson = tryParseJsonContent(appConfigFile.content);
        if (appJson?.expo?.name && typeof appJson.expo.name === 'string' && appJson.expo.name.trim()){
            console.log(`extractProjectName: Name "${appJson.expo.name.trim()}" aus app.json/config (Parse) extrahiert.`);
            return appJson.expo.name.trim();
        }
        if (appJson?.expo?.slug && typeof appJson.expo.slug === 'string' && appJson.expo.slug.trim()){
            console.log(`extractProjectName: Slug "${appJson.expo.slug.trim()}" aus app.json/config (Parse) extrahiert.`);
            return appJson.expo.slug.trim();
        }
      }
    } catch (e) {
      // Sollte selten passieren, da die inneren Parsings schon try-catch haben
      console.error("ProjectContext: Unerwarteter Fehler bei extractProjectName.", e);
    }
    console.log(`extractProjectName: Konnte keinen Namen extrahieren, verwende "${extractedName}".`);
    return extractedName;
  };

  // Aktualisiert die Projektdateien und optional den Namen
  const updateProjectFiles = async (newFiles: ProjectFile[], newName?: string) => {
    let dataToSave: ProjectData | null = null;

    // Stelle sicher, dass newFiles valides Format hat und content string ist
    const validFiles = (newFiles || [])
      .filter(f => f && typeof f.path === 'string')
      .map(f => ({
          path: f.path,
          content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content ?? '', null, 2)
      }));

    setProjectData(prevData => {
      if (!prevData) return null; // Sollte nicht passieren, wenn isLoading false ist

      const nameToSet = newName || extractProjectName(validFiles) || prevData.name;
      dataToSave = {
        ...prevData,
        name: nameToSet,
        files: validFiles, // Benutze die validierten Dateien
        lastModified: Date.now()
      };
      console.log(`ProjectContext: updateProjectFiles - ${validFiles.length} Dateien, Name: "${nameToSet}"`);
      return dataToSave;
    });

    if (dataToSave) {
      await saveProjectToStorage(dataToSave);
      console.log(`ProjectContext: Speicherung nach updateProjectFiles abgeschlossen.`);
    } else {
      console.warn("ProjectContext: updateProjectFiles - dataToSave war null, Speicherung übersprungen.");
    }
  };

  // Aktualisiert nur die Chat-Nachrichten
  const updateMessages = async (newMessages: ChatMessage[]) => {
    let dataToSave: ProjectData | null = null;
    setProjectData(prevData => {
      if (!prevData) return null;
      dataToSave = { ...prevData, messages: newMessages, lastModified: Date.now() };
      console.log(`ProjectContext: updateMessages - ${newMessages.length} Nachrichten`);
      return dataToSave;
    });
    if (dataToSave) { await saveProjectToStorage(dataToSave); }
  };

  // Setzt das Projekt auf das Template zurück
  const clearProject = async () => {
    console.log("ProjectContext: Projekt wird geleert & Template geladen.");
    const templateFiles = await loadTemplateFromFile();
    const newProject = createNewProjectInternal("Neues Projekt"); // Konsistenter Name
    newProject.files = templateFiles;
    newProject.messages = []; // Auch Nachrichten leeren
    setProjectData(newProject);
    await saveProjectToStorage(newProject);
    console.log(`✅ Neues Projekt mit ${templateFiles.length} Template-Dateien erstellt.`);
  };

  // Löscht das aktuelle Projekt (setzt auf Template zurück)
  const deleteCurrentProject = async () => {
    if (!projectData) return;
    Alert.alert(
      `Projekt "${projectData.name}" löschen?`,
      "Alle Dateien und der Chatverlauf gehen verloren. Das Projekt wird auf das leere Template zurückgesetzt.",
      [
        { text: "Abbrechen", style: "cancel" },
        { text: "Löschen", style: "destructive", onPress: clearProject } // Nutzt direkt clearProject
      ]
    );
  };

  // Ändert nur den Projektnamen
  const setProjectName = async (newName: string) => {
    if (!newName?.trim() || !projectData) return;
    const finalName = newName.trim();
    if (projectData.name === finalName) return;

    console.log(`ProjectContext: Projekt umbenannt zu "${finalName}".`);
    const newData = { ...projectData, name: finalName, lastModified: Date.now() };
    setProjectData(newData);
    await saveProjectToStorage(newData);
  };

  // Lädt ein Projekt aus einer ZIP-Datei
  const loadProjectFromZip = async () => {
    console.log("ProjectContext: Starte ZIP-Import...");
    setIsLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/zip', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]?.uri) { setIsLoading(false); return; }

      const zipAsset = result.assets[0];
      const sourcePath = zipAsset.uri;
      const targetPath = FileSystem.cacheDirectory + 'unzipped_project/';

      await FileSystem.deleteAsync(targetPath, { idempotent: true });
      await FileSystem.makeDirectoryAsync(targetPath, { intermediates: true });
      await unzip(sourcePath, targetPath);

      // Rekursive Funktion zum Lesen des Verzeichnisses
      const readDirectory = async (dirUri: string, basePath = ''): Promise<ProjectFile[]> => {
        const items = await FileSystem.readDirectoryAsync(dirUri);
        let files: ProjectFile[] = [];
        for (const item of items) {
          const itemUri = `${dirUri}${item}`;
          const info = await FileSystem.getInfoAsync(itemUri);
          const relativePath = basePath ? `${basePath}/${item}` : item;
          if (info.isDirectory) {
            files = files.concat(await readDirectory(itemUri + '/', relativePath));
          } else {
            try {
              const content = await FileSystem.readAsStringAsync(itemUri, { encoding: FileSystem.EncodingType.UTF8 });
              files.push({ path: relativePath, content }); // Content ist hier immer string
            } catch (readError) { console.warn(`Konnte Datei ${relativePath} nicht lesen:`, readError); }
          }
        }
        return files;
      };

      const newFiles = await readDirectory(targetPath);
      if (newFiles.length === 0) throw new Error("ZIP enthielt keine lesbaren Dateien.");

      const newName = extractProjectName(newFiles) || zipAsset.name.replace('.zip', '') || "Importiertes Projekt";
      const newData: ProjectData = {
        id: uuidv4(), name: newName, files: newFiles, messages: [], lastModified: Date.now()
      };

      setProjectData(newData);
      await saveProjectToStorage(newData);
      Alert.alert("Import erfolgreich", `Projekt "${newName}" (${newFiles.length} Dateien) geladen. Chat zurückgesetzt.`);

    } catch (error: any) {
      console.error("Fehler beim ZIP-Import:", error);
      Alert.alert("Import fehlgeschlagen", error.message || "Unbekannter Fehler.");
    } finally {
      setIsLoading(false);
      await FileSystem.deleteAsync(FileSystem.cacheDirectory + 'unzipped_project/', { idempotent: true });
    }
  };

  // Context-Wert
  const value: ProjectContextProps = {
    projectData,
    isLoading,
    updateProjectFiles,
    updateProject: updateProjectFiles, // Alias
    updateMessages,
    clearProject,
    loadProjectFromZip,
    setProjectName,
    deleteCurrentProject,
    deleteProject: deleteCurrentProject, // Alias
    messages: projectData?.messages || [],
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

// Hook zum Nutzen des Contexts
export const useProject = (): ProjectContextProps => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject muss innerhalb eines ProjectProvider verwendet werden');
  }
  return context;
};

