// contexts/projectStorage.ts (V2.0 - MIT ECHTER ZIP-LOGIK)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProjectData, ProjectFile, ChatMessage } from './types';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { zip, unzip } from 'react-native-zip-archive';
import { v4 as uuidv4 } from 'uuid';
import { normalizePath } from '../utils/chatUtils';
import { validateFilePath, validateFileContent, validateZipImport } from '../lib/validators';

const PROJECT_STORAGE_KEY = 'k1w1_project_data';
const CACHE_DIR = FileSystem.cacheDirectory + 'zip_temp/';

// === HELPER: Verzeichnis rekursiv lesen (wird für ZIP-Import benötigt) ===
const readDirectoryRecursive = async (
  dirUri: string,
  basePath = ''
): Promise<ProjectFile[]> => {
  let files: ProjectFile[] = [];
  const { Validators } = await import('../lib/validators');
  const MAX_FILE_SIZE = Validators.constants.MAX_FILE_SIZE;
  const MAX_TOTAL_FILES = Validators.constants.MAX_FILES_IN_ZIP;
  
  try {
    const items = await FileSystem.readDirectoryAsync(dirUri);
    
    for (const item of items) {
      // ✅ FIX: Prüfe Dateianzahl NACH dem Hinzufügen, nicht vorher
      if (files.length >= MAX_TOTAL_FILES) {
        console.warn(`[projectStorage] Maximale Dateianzahl erreicht: ${MAX_TOTAL_FILES}`);
        return files;
      }
      const itemUri = `${dirUri}${item}`;
      const info = await FileSystem.getInfoAsync(itemUri);
      const relativePath = basePath ? `${basePath}/${item}` : item;
      
      if (info.isDirectory) {
        files = files.concat(await readDirectoryRecursive(itemUri + '/', relativePath));
      } else {
        try {
          // ✅ SICHERHEIT: Dateigröße prüfen
          const fileInfo = info as { exists: true; size: number; isDirectory: boolean; uri: string };
          if (fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
            console.warn(
              `[projectStorage] Datei zu groß, übersprungen: ${relativePath}`,
              `Größe: ${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB`
            );
            continue;
          }
          
          const content = await FileSystem.readAsStringAsync(itemUri, { 
            encoding: FileSystem.EncodingType.UTF8 
          });
          
          // ✅ SICHERHEIT: Pfad UND Content validieren
          const pathValidation = validateFilePath(relativePath);
          if (!pathValidation.valid) {
            console.warn(
              `[projectStorage] Ungültiger Pfad übersprungen: ${relativePath}`,
              pathValidation.errors
            );
            continue;
          }
          
          const contentValidation = validateFileContent(content);
          if (!contentValidation.valid) {
            console.warn(
              `[projectStorage] Ungültiger Content übersprungen: ${relativePath}`,
              contentValidation.error
            );
            continue;
          }
          
          const normalizedPath = pathValidation.normalized || normalizePath(relativePath);
          files.push({ path: normalizedPath, content });
        } catch (error) {
          console.warn(`[projectStorage] Konnte nicht lesen: ${relativePath}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`[projectStorage] Verzeichnis-Fehler ${dirUri}: `, error);
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
      // Migration: Alte 'messages' Property zu 'chatHistory'
      const projectWithMessages = project as ProjectData & { messages?: ChatMessage[] };
      project.chatHistory = projectWithMessages.messages || []; 
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

  } catch (error: unknown) {
    console.error('❌ Fehler beim ZIP-Export:', error);
    const errorMessage = error instanceof Error ? error.message : 'ZIP-Export fehlgeschlagen';
    throw new Error(errorMessage);
  }
};

export const importProjectFromZipFile = async (): Promise<{
  project: ProjectData;
  fileCount: number;
  messageCount: number;
  metadata?: Record<string, unknown>;
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

    console.log('📦 Entpacke...');
    await unzip(zipAsset.uri, CACHE_DIR);
    
    const newFiles = await readDirectoryRecursive(CACHE_DIR);
    if (newFiles.length === 0) throw new Error('ZIP enthält keine Dateien');
    
    // ✅ SICHERHEIT: Zusätzliche ZIP-Validierung
    console.log('🔍 Validiere ZIP-Inhalte...');
    const zipValidation = validateZipImport(newFiles);
    
    if (!zipValidation.valid) {
      const errorMsg = [
        'ZIP-Validierung fehlgeschlagen:',
        ...zipValidation.errors,
        `Ungültige Dateien: ${zipValidation.invalidFiles.length}`,
      ].join('\n');
      
      console.error('[projectStorage]', errorMsg);
      throw new Error(errorMsg);
    }
    
    if (zipValidation.invalidFiles.length > 0) {
      console.warn(
        `[projectStorage] ${zipValidation.invalidFiles.length} ungültige Dateien übersprungen:`,
        zipValidation.invalidFiles.map(f => `${f.path}: ${f.reason}`)
      );
    }
    
    // Verwende nur validierte Dateien
    const validatedFiles = zipValidation.validFiles;

    const newName = zipAsset.name.replace(/\.zip$/i, '') || 'Importiertes Projekt';
    
    // (Hier könnten wir auch nach einer 'project.json' im ZIP suchen)
    const newProject: ProjectData = {
      id: uuidv4(),
      name: newName,
      files: validatedFiles, // ✅ Nur validierte Dateien verwenden
      chatHistory: [], // Ein importiertes Projekt startet mit leerem Chat
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    
    console.log(
      `✅ ZIP-Import erfolgreich: ${validatedFiles.length} Dateien validiert`
    );
    
    return {
      project: newProject,
      fileCount: validatedFiles.length,
      messageCount: 0
    };

  } catch (error: unknown) {
    console.error('❌ Fehler beim ZIP-Import:', error);
    if (error instanceof Error) {
      if (error.message.includes('Import abgebrochen')) {
        throw error;
      }
      throw new Error(error.message || 'ZIP-Import fehlgeschlagen');
    }
    throw new Error('ZIP-Import fehlgeschlagen');
  } finally {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }).catch(() => {});
  }
};

