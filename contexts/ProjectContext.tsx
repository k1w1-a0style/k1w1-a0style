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
  content: string | object;
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

const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);

const PROJECT_STORAGE_KEY = 'k1w1_current_project_v4';

const createNewProjectInternal = (name = "Neues Projekt"): ProjectData => ({
  id: uuidv4(),
  name: name,
  files: [],
  messages: [],
  lastModified: Date.now()
});

// ✅ NEU: Template aus JSON laden
const loadTemplateFromFile = async (): Promise<ProjectFile[]> => {
  try {
    console.log("📦 ProjectContext: Lade Template aus templates/expo-sdk54-base.json...");
    
    // Template aus Asset laden (Bundle-Zeit)
    const templateModule = require('../templates/expo-sdk54-base.json');
    
    if (!Array.isArray(templateModule) || templateModule.length === 0) {
      throw new Error("Template ist leer oder ungültig.");
    }

    console.log(`✅ Template geladen: ${templateModule.length} Dateien`);
    return templateModule as ProjectFile[];
    
  } catch (error: any) {
    console.error("❌ Template konnte nicht geladen werden:", error);
    // Fallback: Minimales Template
    return [
      {
        path: "README.md",
        content: "# Neues Projekt\n\nTemplate konnte nicht geladen werden.\nBitte manuell erstellen oder ZIP importieren."
      }
    ];
  }
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);

  const saveProjectToStorage = async (dataToSave: ProjectData | null) => {
    try {
      const jsonValue = JSON.stringify(dataToSave);
      await AsyncStorage.setItem(PROJECT_STORAGE_KEY, jsonValue);
      console.log(`Storage gespeichert: ${dataToSave?.name}, ${dataToSave?.files?.length || 0} Dateien`);
    } catch (e) {
      console.error("SingleProjectContext: Fehler beim Speichern", e);
    }
  };

  const loadProjectFromStorage = useCallback(async () => {
    console.log("SingleProjectContext: Ladevorgang gestartet...");
    let loadedData: ProjectData | null = null;
    let needsSave = false;

    try {
      const jsonValue = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
      if (jsonValue) {
        loadedData = JSON.parse(jsonValue);
        if (!loadedData.messages) loadedData.messages = [];
        if (!loadedData.id) loadedData.id = uuidv4();
        console.log(`SingleProjectContext: Projekt "${loadedData.name}" geladen.`);
      } else {
        // ✅ NEU: Template laden bei leerem Storage
        console.log("SingleProjectContext: Kein Projekt. Erstelle mit Template.");
        const templateFiles = await loadTemplateFromFile();
        
        loadedData = createNewProjectInternal();
        loadedData.files = templateFiles;
        
        needsSave = true;
      }
    } catch (e) {
      console.error("SingleProjectContext: Fehler beim Laden/Parsen", e);
      
      // ✅ NEU: Auch bei Fehler Template nutzen
      const templateFiles = await loadTemplateFromFile();
      
      loadedData = createNewProjectInternal("Fehler-Projekt");
      loadedData.files = templateFiles;
      
      needsSave = true;
    }

    setProjectData(loadedData);

    if (needsSave) {
      await saveProjectToStorage(loadedData);
      console.log("SingleProjectContext: Initiales Projekt gespeichert.");
    }

    setIsLoading(false);
    console.log("SingleProjectContext: Ladevorgang abgeschlossen.");
  }, []);

  useEffect(() => {
    loadProjectFromStorage();
  }, [loadProjectFromStorage]);

  const extractProjectName = (files: ProjectFile[]): string => {
    let extractedName = "Unbenanntes Projekt";
    try {
      const pkgJsonFile = files.find(f => f.path === 'package.json');
      if (pkgJsonFile?.content) {
        try {
          const pkg = (typeof pkgJsonFile.content === 'string')
            ? JSON.parse(pkgJsonFile.content)
            : pkgJsonFile.content;
          if (pkg.name && typeof pkg.name === 'string' && pkg.name.trim()) {
            extractedName = pkg.name.trim();
            return extractedName;
          }
        } catch (e) {
          console.warn("ProjectContext: package.json konnte nicht geparst werden.", e);
        }
      }

      const appConfigFile = files.find(f => f.path === 'app.config.js' || f.path === 'app.json');
      if (appConfigFile?.content && typeof appConfigFile.content === 'string') {
        const nameMatchJS = appConfigFile.content.match(/name:\s*["'](.*?)["']/);
        if (nameMatchJS && nameMatchJS[1] && nameMatchJS[1].trim()) return nameMatchJS[1].trim();

        const slugMatchJS = appConfigFile.content.match(/slug:\s*["'](.*?)["']/);
        if (slugMatchJS && slugMatchJS[1] && slugMatchJS[1].trim()) return slugMatchJS[1].trim();

        try {
          const appJson = JSON.parse(appConfigFile.content);
          if (appJson.expo?.name && typeof appJson.expo.name === 'string' && appJson.expo.name.trim())
            return appJson.expo.name.trim();
          if (appJson.expo?.slug && typeof appJson.expo.slug === 'string' && appJson.expo.slug.trim())
            return appJson.expo.slug.trim();
        } catch (e) {
          /* Ignore */
        }
      }
    } catch (e) {
      console.error("SingleProjectContext: Fehler bei extractProjectName.", e);
    }
    return extractedName;
  };

  // ✅ FIX: AsyncStorage AUSSERHALB von setState
  const updateProjectFiles = async (files: ProjectFile[], newName?: string) => {
    let dataToSave: ProjectData | null = null;

    // 1. State synchron aktualisieren
    setProjectData(prevData => {
      if (!prevData) return prevData;

      const nameToSet = newName || extractProjectName(files) || prevData.name;
      dataToSave = {
        ...prevData,
        name: nameToSet,
        files: files,
        lastModified: Date.now()
      };

      console.log(`ProjectContext: Dateien aktualisiert - ${files.length} Dateien, Name: "${nameToSet}"`);

      return dataToSave;
    });

    // 2. Dann async speichern (außerhalb setState)
    if (dataToSave) {
      await saveProjectToStorage(dataToSave);
      console.log(`ProjectContext: Speicherung abgeschlossen.`);
    }
  };

  // ✅ FIX: AsyncStorage AUSSERHALB von setState
  const updateMessages = async (newMessages: ChatMessage[]) => {
    let dataToSave: ProjectData | null = null;

    // 1. State synchron aktualisieren
    setProjectData(prevData => {
      if (!prevData) return prevData;

      dataToSave = {
        ...prevData,
        messages: newMessages,
        lastModified: Date.now()
      };

      console.log(`ProjectContext: Messages aktualisiert - ${newMessages.length} Nachrichten`);

      return dataToSave;
    });

    // 2. Dann async speichern (außerhalb setState)
    if (dataToSave) {
      await saveProjectToStorage(dataToSave);
    }
  };

  // ✅ NEU: Template laden beim Projekt leeren
  const clearProject = async () => {
    console.log("SingleProjectContext: Projekt wird geleert & Template geladen.");
    
    const templateFiles = await loadTemplateFromFile();
    
    const newProject = createNewProjectInternal();
    newProject.files = templateFiles;
    
    setProjectData(newProject);
    await saveProjectToStorage(newProject);
    
    console.log(`✅ Neues Projekt mit ${templateFiles.length} Template-Dateien erstellt.`);
  };

  const deleteCurrentProject = async () => {
    if (!projectData) return;

    Alert.alert(
      `Projekt "${projectData.name}" löschen?`,
      "Diese Aktion kann nicht rückgängig gemacht werden.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            console.log(`ProjectContext: Lösche Projekt ${projectData.id} ("${projectData.name}")`);
            console.log("ProjectContext: Erstelle 'Neues Projekt' mit Template.");
            
            // ✅ NEU: Template auch beim Löschen laden
            const templateFiles = await loadTemplateFromFile();
            
            const newProject = createNewProjectInternal();
            newProject.files = templateFiles;
            
            setProjectData(newProject);
            await saveProjectToStorage(newProject);
            console.log(`ProjectContext: Altes Projekt gelöscht. Neues Projekt ${newProject.id} mit Template aktiv.`);
          }
        }
      ]
    );
  };

  const setProjectName = async (newName: string) => {
    if (!newName || !newName.trim() || !projectData) return;

    const finalName = newName.trim();
    if (projectData.name === finalName) return;

    console.log(`SingleProjectContext: Projekt umbenannt zu "${finalName}".`);
    const newData = { ...projectData, name: finalName, lastModified: Date.now() };
    setProjectData(newData);
    await saveProjectToStorage(newData);
  };

  const loadProjectFromZip = async () => {
    console.log("SingleProjectContext: Starte ZIP-Import...");
    setIsLoading(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsLoading(false);
        return;
      }

      const zipAsset = result.assets[0];
      const sourcePath = zipAsset.uri;
      const targetPath = FileSystem.cacheDirectory + 'unzipped_project/';

      if (!sourcePath) {
        throw new Error("Konnte ZIP-Datei Pfad nicht finden.");
      }

      await FileSystem.deleteAsync(targetPath, { idempotent: true });
      await FileSystem.makeDirectoryAsync(targetPath, { intermediates: true });
      await unzip(sourcePath, targetPath);

      const readDirectory = async (dirUri: string, basePath = ''): Promise<ProjectFile[]> => {
        const filesInfo = await FileSystem.readDirectoryAsync(dirUri);
        let projectFiles: ProjectFile[] = [];

        for (const fileName of filesInfo) {
          const fileUri = `${dirUri}${fileName}`;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          const relativePath = basePath ? `${basePath}/${fileName}` : fileName;

          if (fileInfo.isDirectory) {
            projectFiles = projectFiles.concat(await readDirectory(fileUri + '/', relativePath));
          } else {
            try {
              const content = await FileSystem.readAsStringAsync(fileUri, {
                encoding: FileSystem.EncodingType.UTF8
              });
              projectFiles.push({ path: relativePath, content });
            } catch (readError) {
              console.warn(`Konnte Datei ${relativePath} nicht lesen:`, readError);
            }
          }
        }
        return projectFiles;
      };

      const newFiles = await readDirectory(targetPath);

      if (newFiles.length === 0) {
        throw new Error("ZIP-Datei war leer oder enthielt keine lesbaren Dateien.");
      }

      const newName = extractProjectName(newFiles) || zipAsset.name.replace('.zip', '') || "Importiertes Projekt";

      const newData: ProjectData = {
        id: uuidv4(),
        name: newName,
        files: newFiles,
        messages: [],
        lastModified: Date.now()
      };

      setProjectData(newData);
      await saveProjectToStorage(newData);

      Alert.alert("Import erfolgreich", `Projekt "${newName}" mit ${newFiles.length} Dateien geladen. Chatverlauf wurde zurückgesetzt.`);

    } catch (error: any) {
      console.error("Fehler beim ZIP-Import:", error);
      Alert.alert("Import fehlgeschlagen", error.message || "Ein unbekannter Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
      await FileSystem.deleteAsync(FileSystem.cacheDirectory + 'unzipped_project/', { idempotent: true });
    }
  };

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
