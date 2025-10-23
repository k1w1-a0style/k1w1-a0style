import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Alert, StyleSheet } from 'react-native'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values'; // Erforderlich für uuid
import { v4 as uuidv4 } from 'uuid'; 
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { unzip } from 'react-native-zip-archive';

// *** VEREINFACHTER SINGLE-PROJECT Context (OHNE Auto-Load) ***

// Typen
export type ProjectFile = { path: string; content: string; };
export type ProjectData = { name: string; files: ProjectFile[]; }; 

// Context Typ
interface ProjectContextProps {
  projectData: ProjectData | null; 
  isLoading: boolean; 
  updateProject: (files: ProjectFile[], newName?: string) => Promise<void>; 
  clearProject: () => Promise<void>; 
  loadProjectFromZip: () => Promise<void>; 
  setProjectName: (newName: string) => Promise<void>; 
}

const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);
const PROJECT_STORAGE_KEY = 'k1w1_current_project_v3'; // Neuer Schlüssel

const INITIAL_PROJECT_DATA: ProjectData = { name: "Neues Projekt", files: [] };

// Provider
export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true); // Startet true
  const [projectData, setProjectData] = useState<ProjectData | null>(null); // Startet null, um Ladezustand zu signalisieren

  // Speicherfunktion
  const saveProjectToStorage = async (dataToSave: ProjectData | null) => { try { const jsonValue = JSON.stringify(dataToSave); await AsyncStorage.setItem(PROJECT_STORAGE_KEY, jsonValue); } catch (e) { console.error("SingleProjectContext: Fehler beim Speichern", e); } };

  // --- Ladefunktion (mit Timeout-Fix) ---
  const loadProjectFromStorage = useCallback(async () => {
    console.log("SingleProjectContext: Ladevorgang gestartet...");
    let loadedData: ProjectData | null = null;
    let needsSave = false;
    try {
      const jsonValue = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
      loadedData = jsonValue ? JSON.parse(jsonValue) : null;
      if (loadedData) { console.log(`SingleProjectContext: Projekt "${loadedData.name}" geladen.`); }
      else { console.log("SingleProjectContext: Kein Projekt. Erstelle 'Neues Projekt'."); loadedData = INITIAL_PROJECT_DATA; needsSave = true; }
    } catch (e) { console.error("SingleProjectContext: Fehler beim Laden/Parsen", e); loadedData = INITIAL_PROJECT_DATA; needsSave = true; }
    
    // Setze den State
    setProjectData(loadedData);
    console.log(`SingleProjectContext: projectData State gesetzt.`);

    if (needsSave && loadedData) {
       saveProjectToStorage(loadedData).then(() => {
           console.log("SingleProjectContext: Initiales 'Neues Projekt' gespeichert.");
           // Setze isLoading verzögert, um Race Condition mit Navigation zu vermeiden
           setTimeout(() => { setIsLoading(false); console.log("SingleProjectContext: Ladevorgang abgeschlossen (nach Init-Save)."); }, 50);
       });
    } else {
        setTimeout(() => { 
            setIsLoading(false); 
            console.log("SingleProjectContext: Ladevorgang abgeschlossen (kein Init-Save nötig).");
        }, 50);
    }
  }, []);

  useEffect(() => { loadProjectFromStorage(); }, [loadProjectFromStorage]);

  // --- Projektname extrahieren (Robuste Version) ---
  const extractProjectName = (files: ProjectFile[]): string => {
    let extractedName = "Unbenanntes Projekt"; try { const pkgJsonFile = files.find(f => f.path === 'package.json'); if (pkgJsonFile?.content) { try { const pkg = JSON.parse(pkgJsonFile.content); if (pkg.name && typeof pkg.name === 'string' && pkg.name.trim()) { extractedName = pkg.name.trim(); return extractedName; } } catch (e) { console.warn("ProjectContext: package.json konnte nicht geparst werden.", e); } } const appConfigFile = files.find(f => f.path === 'app.config.js' || f.path === 'app.json'); if (appConfigFile?.content) { const nameMatchJS = appConfigFile.content.match(/name:\s*["'](.*?)["']/); if (nameMatchJS && nameMatchJS[1] && nameMatchJS[1].trim()) return nameMatchJS[1].trim(); const slugMatchJS = appConfigFile.content.match(/slug:\s*["'](.*?)["']/); if (slugMatchJS && slugMatchJS[1] && slugMatchJS[1].trim()) return slugMatchJS[1].trim(); try { const appJson = JSON.parse(appConfigFile.content); if (appJson.expo?.name && typeof appJson.expo.name === 'string' && appJson.expo.name.trim()) return appJson.expo.name.trim(); if (appJson.expo?.slug && typeof appJson.expo.slug === 'string' && appJson.expo.slug.trim()) return appJson.expo.slug.trim(); } catch (e) { /* Ignoriere Parse-Fehler hier, da es JS sein könnte */ } } } catch (e) { console.error("SingleProjectContext: Fehler bei extractProjectName.", e); } return extractedName;
  };

  // --- Context-Funktionen ---
  const createNewProject = useCallback(async () => {
    console.log("SingleProjectContext: Projekt wird geleert (createNewProject).");
    setProjectData(INITIAL_PROJECT_DATA);
    await saveProjectToStorage(INITIAL_PROJECT_DATA);
  }, []); // Hängt von nichts ab

  const loadProject = (id: string) => { /* Diese Funktion ist im Single-Project-Modell nicht mehr nötig, aber wir lassen den Dummy da, falls der Drawer ihn ruft */ console.log("loadProject aufgerufen, aber im Single-Project-Modus ignoriert."); };

  const updateProject = useCallback(async (files: ProjectFile[], newName?: string) => {
    if (!files) { console.warn("updateProject mit 'null' aufgerufen."); return; }
    if (files.length === 0 && projectData?.files && projectData.files.length > 0 && !(newName && newName === INITIAL_PROJECT_DATA.name)) { console.warn("Leeres Update durch KI? Abgebrochen."); return; }
    const nameToSet = newName || extractProjectName(files) || projectData?.name || "Unbenanntes Projekt";
    const newData: ProjectData = { name: nameToSet, files: files };
    setProjectData(newData);
    console.log(`SingleProjectContext: Projekt "${nameToSet}" live gespeichert.`);
    await saveProjectToStorage(newData);
  }, [projectData]); // Hängt von projectData ab (für Fallback-Namen)

  const clearProject = useCallback(async () => {
      console.log("SingleProjectContext: Projekt wird geleert (clearProject).");
      setProjectData(INITIAL_PROJECT_DATA);
      await saveProjectToStorage(INITIAL_PROJECT_DATA);
  }, []); // Hängt von nichts ab

  const setProjectName = useCallback(async (newName: string) => {
      if (!newName || !newName.trim()) return;
      const finalName = newName.trim();
      setProjectData(prevData => {
          // Stelle sicher, dass prevData nicht null ist (obwohl es nach dem Laden nicht sein sollte)
          const currentData = prevData || INITIAL_PROJECT_DATA;
          if (currentData.name === finalName) return currentData; // Keine Änderung
          
          console.log(`SingleProjectContext: Projekt umbenannt zu "${finalName}".`);
          const newData = { ...currentData, name: finalName };
          saveProjectToStorage(newData); // Asynchron speichern
          return newData; // Neuen State zurückgeben
      });
  }, []); // Leeres Array, da wir die 'prevData' Updater-Funktion nutzen

  const loadProjectFromZip = useCallback(async () => { 
      console.log("SingleProjectContext: Starte ZIP-Import...");
      setIsLoading(true); 
      try {
          const result = await DocumentPicker.getDocumentAsync({ type: 'application/zip', copyToCacheDirectory: true, });
          if (result.canceled || !result.assets || result.assets.length === 0) { setIsLoading(false); return; }
          const zipAsset = result.assets[0];
          const sourcePath = zipAsset.uri; 
          const targetPath = FileSystem.cacheDirectory + 'unzipped_project/'; 
          if (!sourcePath) { throw new Error("Konnte ZIP-Datei Pfad nicht finden."); }
          await FileSystem.deleteAsync(targetPath, { idempotent: true });
          await FileSystem.makeDirectoryAsync(targetPath, { intermediates: true });
          console.log(`Entpacke ${sourcePath} nach ${targetPath}`);
          await unzip(sourcePath, targetPath);
          console.log("ZIP erfolgreich entpackt.");
          
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
                          console.log(`Lese Datei: ${relativePath}`);
                          const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
                          projectFiles.push({ path: relativePath, content });
                      } catch (readError) { console.warn(`Konnte Datei ${relativePath} nicht lesen:`, readError); }
                  }
              }
              return projectFiles;
          };
          const newFiles = await readDirectory(targetPath);
          if (newFiles.length === 0) { throw new Error("ZIP-Datei war leer oder enthielt keine lesbaren Dateien."); }
          const newName = extractProjectName(newFiles) || zipAsset.name.replace('.zip', '') || "Importiertes Projekt";
          
          // Rufe updateProject auf (setzt State UND speichert)
          await updateProject(newFiles, newName); 

          Alert.alert("Import erfolgreich", `Projekt "${newName}" mit ${newFiles.length} Dateien geladen.`);
      } catch (error: any) { console.error("Fehler beim ZIP-Import:", error); Alert.alert("Import fehlgeschlagen", error.message || "Ein unbekannter Fehler ist aufgetreten."); } 
      finally { 
          setIsLoading(false); 
          await FileSystem.deleteAsync(FileSystem.cacheDirectory + 'unzipped_project/', { idempotent: true });
      }
  }, [updateProject]); // Hängt von updateProject ab

  // === WICHTIG: return null während Laden ===
  if (isLoading) {
      console.log("--- SingleProjectProvider lädt noch (isLoading=true) ---");
      return null;
  }
  
  const value = { projectData, isLoading, updateProject, clearProject, loadProjectFromZip, setProjectName };
  return ( <ProjectContext.Provider value={value}> {children} </ProjectContext.Provider> );
};

export const useProject = (): ProjectContextProps => { const context = useContext(ProjectContext); if (!context) { throw new Error('useProject muss innerhalb eines ProjectProvider verwendet werden'); } return context; };

// Styles (nicht mehr gebraucht)
const styles = StyleSheet.create({ /* ... */ });

