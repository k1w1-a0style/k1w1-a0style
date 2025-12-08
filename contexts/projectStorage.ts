// contexts/projectStorage.ts (V2.0 - MIT ECHTER ZIP-LOGIK)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProjectData, ProjectFile } from './types';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { zip, unzip } from 'react-native-zip-archive';
import { v4 as uuidv4 } from 'uuid';

const PROJECT_STORAGE_KEY = 'k1w1_project_data';
const CACHE_DIR = FileSystem.cacheDirectory + 'zip_temp/';

// === HELPER: Verzeichnis rekursiv lesen (wird für ZIP-Import benötigt) ===
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

// === PROJEKT SPEICHERN/LADEN (Unverändert) ===
export const saveProjectToStorage = async (project: ProjectData): Promise<void> => {
  try {
    const projectString = JSON.stringify(project);
    await AsyncStorage.setItem(PROJECT_STORAGE_KEY, projectString);
    console.log('💾 Projekt gespeichert:', project.name);
  } catch (error) {
    console.error('❌ Fehler beim Speichern:', error);
    throw new Error('Projekt konnte nicht gespeichert werden');
  }
};

export const loadProjectFromStorage = async (): Promise<ProjectData | null> => {
  try {
    const projectString = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
    if (!projectString) {
      console.log('📂 Kein gespeichertes Projekt gefunden');
      return null;
    }
    const project = JSON.parse(projectString);
    console.log('📖 Projekt geladen:', project.name);
    if (!project.files) {
      project.files = [];
      console.log('🔧 files Array repariert');
    }
    if (!project.chatHistory) {
      // Repariere alte Speicherstände
      project.chatHistory = (project as any).messages || []; 
      console.log('🔧 chatHistory Array repariert');
    }
    return project;
  } catch (error) {
    console.error('❌ Fehler beim Laden:', error);
    return null;
  }
};

export const clearProjectFromStorage = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PROJECT_STORAGE_KEY);
    console.log('🗑️ Projekt aus Storage gelöscht');
  } catch (error) {
    console.error('❌ Fehler beim Löschen:', error);
    throw new Error('Projekt konnte nicht gelöscht werden');
  }
};

// === ECHTE ZIP-FUNKTIONEN ===

export const exportProjectAsZipFile = async (project: ProjectData): Promise<{
  projectName: string;
  fileCount: number;
  messageCount: number;
}> => {
  console.log('🎯 Export-Anfrage für:', project.name);
  
  const projectFiles = project.files;
  const projectName = project.name.replace(/[\s\/]+/g, '_') || "projekt";
  
  try {
    const tempDir = CACHE_DIR + 'projekt-export/';
    const zipPath = FileSystem.cacheDirectory + `${projectName}.zip`;

    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    await FileSystem.deleteAsync(zipPath, { idempotent: true });
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

    for (const file of projectFiles) {
      const contentString = typeof file.content === 'string' ?
        file.content :
        JSON.stringify(file.content, null, 2);
        
      const filePath = `${tempDir}${file.path}`;
      const dirName = filePath.substring(0, filePath.lastIndexOf('/'));
      
      if (dirName && dirName !== tempDir.slice(0, -1)) {
        await FileSystem.makeDirectoryAsync(dirName, { intermediates: true });
      }
      
      await FileSystem.writeAsStringAsync(filePath, contentString, {
        encoding: FileSystem.EncodingType.UTF8
      });
    }

    const resultPath = await zip(tempDir, zipPath);
    const shareableUri = `file://${resultPath}`;
    
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
    }
    
    await Sharing.shareAsync(shareableUri, {
      mimeType: 'application/zip',
      dialogTitle: `Projekt '${project.name}' exportieren`,
      UTI: 'com.pkware.zip-archive'
    });
    
    await FileSystem.deleteAsync(tempDir, { idempotent: true });

    return {
      projectName: project.name || 'Unbenannt',
      fileCount: (project.files || []).length,
      messageCount: (project.chatHistory || []).length
    };

  } catch (error: any) {
    console.error('❌ Fehler beim ZIP-Export:', error);
    throw new Error(error.message || 'ZIP-Export fehlgeschlagen');
  }
};

export const importProjectFromZipFile = async (): Promise<{
  project: ProjectData;
  fileCount: number;
  messageCount: number;
  metadata?: any;
}> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      throw new Error('Import abgebrochen');
    }
    
    const zipAsset = result.assets[0];
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });

    console.log(' Entpacke...');
    await unzip(zipAsset.uri, CACHE_DIR);
    
    const newFiles = await readDirectoryRecursive(CACHE_DIR);
    if (newFiles.length === 0) throw new Error('ZIP enthält keine Dateien');

    const newName = zipAsset.name.replace(/\.zip$/i, '') || 'Importiertes Projekt';
    
    // (Hier könnten wir auch nach einer 'project.json' im ZIP suchen)
    const newProject: ProjectData = {
      id: uuidv4(),
      name: newName,
      slug: newName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      files: newFiles,
      chatHistory: [], // Ein importiertes Projekt startet mit leerem Chat
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    
    return {
      project: newProject,
      fileCount: newFiles.length,
      messageCount: 0
    };

  } catch (error: any) {
    console.error('❌ Fehler beim ZIP-Import:', error);
    if (error.message.includes('Import abgebrochen')) {
      throw error;
    }
    throw new Error(error.message || 'ZIP-Import fehlgeschlagen');
  } finally {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }).catch(() => {});
  }
};

