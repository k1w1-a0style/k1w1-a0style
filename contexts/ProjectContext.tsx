// contexts/ProjectContext.tsx (V15 - ALL CRITICAL FIXES APPLIED)
import { v4 as uuidv4 } from 'uuid';
import { Mutex } from 'async-mutex'; // ✅ SICHERHEIT: Race Condition Protection
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { ProjectData, ProjectFile, ChatMessage, ProjectContextProps } from './types';
import {
  saveProjectToStorage,
  loadProjectFromStorage,
  exportProjectAsZipFile,
  importProjectFromZipFile,
} from './projectStorage';
import {
  getGitHubToken,
  getWorkflowRuns,
} from './githubService';
// ✅ FIX: Top-level imports statt dynamic imports
import { validateFilePath, validateFileContent } from '../lib/validators';

const loadTemplateFromFile = async (): Promise<ProjectFile[]> => {
  try {
    const template = require('../templates/expo-sdk54-base.json');
    if (!Array.isArray(template) || template.length === 0) {
      throw new Error('Template ist ungültig');
    }
    return template.map((file: any) => ({
      ...file,
      content:
        typeof file.content === 'string'
          ? file.content
          : JSON.stringify(file.content ?? '', null, 2),
    })) as ProjectFile[];
  } catch (error) {
    console.error('X Template Fehler:', error);
    return [{ path: 'README.md', content: '# Template Fehler' }];
  }
};

const SAVE_DEBOUNCE_MS = 500;
const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);

export {
  getGitHubToken,
  saveGitHubToken,
  saveExpoToken,
  getExpoToken,
  syncRepoSecrets,
} from './githubService';

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ SICHERHEIT: Mutex für atomare Updates (verhindert Race Conditions)
  const mutexRef = useRef(new Mutex());

  const debouncedSave = useCallback((project: ProjectData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveProjectToStorage(project).catch(error => {
        console.error('[ProjectContext] Save error:', error);
      });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // ✅ SICHERHEIT: Mutex-geschützte Updates (keine Race Conditions mehr!)
  const updateProject = useCallback(
    async (updater: (prev: ProjectData) => ProjectData) => {
      const release = await mutexRef.current.acquire();
      
      try {
        setProjectData(prev => {
          if (!prev) {
            // ✅ FIX: Release im finally block, nicht hier
            return prev;
          }
          
          const updated = updater(prev);
          const finalProject = { 
            ...updated, 
            lastModified: new Date().toISOString() 
          };
          
          // Debounced save für UI-Performance
          debouncedSave(finalProject);
          
          return finalProject;
        });
      } catch (error) {
        console.error('[ProjectContext] Update error:', error);
      } finally {
        release();
      }
    },
    [debouncedSave],
  );

  // ✅ FIX: MERGE statt OVERWRITE! + Mutex-Protection
  const updateProjectFiles = useCallback(
    async (files: ProjectFile[], newName?: string) => {
      await updateProject(prev => {
        const fileMap = new Map(prev.files.map(f => [f.path, f]));
        files.forEach(file => {
          fileMap.set(file.path, file);
        });
        const mergedFiles = Array.from(fileMap.values());
        console.log(
          `📝 Dateien aktualisiert: ${files.length} geändert, ${mergedFiles.length} gesamt`,
        );
        return {
          ...prev,
          files: mergedFiles,
          name: newName || prev.name,
        };
      });
    },
    [updateProject],
  );

  const setProjectName = useCallback(
    async (newName: string) => {
      await updateProject(prev => ({
        ...prev,
        name: newName,
      }));
    },
    [updateProject],
  );

  const addChatMessage = useCallback(
    async (message: ChatMessage) => {
      await updateProject(prev => ({
        ...prev,
        chatHistory: [...(prev.chatHistory || []), message],
      }));
    },
    [updateProject],
  );

  const setPackageName = useCallback(
    async (packageName: string) => {
      await updateProject(prev => ({
        ...prev,
        packageName,
      }));
    },
    [updateProject],
  );

  // ✅ FIX: Neues Projekt erstellen - mit updateProject + Mutex
  const createNewProject = useCallback(async () => {
    Alert.alert(
      'Neues Projekt',
      'Möchtest du ein neues Projekt erstellen? Der aktuelle Chat und alle Dateien werden zurückgesetzt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Neu erstellen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const templateFiles = await loadTemplateFromFile();
              const newProject: ProjectData = {
                id: uuidv4(),
                name: 'Neues Projekt',
                slug: 'neues-projekt',
                files: templateFiles,
                chatHistory: [],
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
              };
              
              // ✅ FIX: Verwende Mutex-Schutz für konsistenten State
              const release = await mutexRef.current.acquire();
              try {
                setProjectData(newProject);
                await saveProjectToStorage(newProject);
              } finally {
                release();
              }
              
              Alert.alert('Erfolg', 'Neues Projekt wurde erstellt!');
              console.log('✅ Neues Projekt erstellt und gespeichert.');
            } catch (error: any) {
              Alert.alert(
                'Fehler',
                error.message || 'Projekt konnte nicht erstellt werden',
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  }, []);

  const exportProjectAsZip = useCallback(async () => {
    if (!projectData) {
      Alert.alert('Export Fehlgeschlagen', 'Kein Projekt zum Exportieren vorhanden.');
      return;
    }
    try {
      const result = await exportProjectAsZipFile(projectData);
      Alert.alert(
        'Export erfolgreich',
        `${result.fileCount} Dateien als ZIP gespeichert.`,
      );
    } catch (error: any) {
      console.error('Fehler beim ZIP-Export:', error);
      Alert.alert(
        'Export Fehlgeschlagen',
        error.message || 'Ein unbekannter Fehler ist aufgetreten.',
      );
    }
  }, [projectData]);

  const importProjectFromZip = useCallback(async () => {
    Alert.alert(
      'Import aus ZIP',
      'WARNUNG: Überschreibt das aktuelle Projekt. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Auswählen',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await importProjectFromZipFile();
              result.project.chatHistory = []; // ✅ Chat zurücksetzen
              
              // ✅ FIX: Mutex-Schutz für konsistenten State
              const release = await mutexRef.current.acquire();
              try {
                setProjectData(result.project);
                await saveProjectToStorage(result.project);
              } finally {
                release();
              }
              
              Alert.alert(
                'Import erfolgreich',
                `Projekt "${result.project.name}" importiert (${result.fileCount} Dateien).`,
              );
            } catch (error: any) {
              Alert.alert(
                'Import fehlgeschlagen',
                error.message || 'Fehler beim Importieren',
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  }, []);

  const createFile = useCallback(
    async (path: string, content: string) => {
      // ✅ FIX: Top-level imports (bereits importiert)
      
      // Validiere Pfad
      const pathValidation = validateFilePath(path);
      if (!pathValidation.valid) {
        Alert.alert(
          'Ungültiger Dateipfad',
          pathValidation.errors.join('\n')
        );
        return;
      }
      
      // Validiere Content
      const contentValidation = validateFileContent(content);
      if (!contentValidation.valid) {
        Alert.alert(
          'Ungültiger Dateiinhalt',
          contentValidation.error || 'Datei ist zu groß'
        );
        return;
      }
      
      const validPath = pathValidation.normalized || path;
      
      await updateProject(prev => {
        if (prev.files.some(f => f.path === validPath)) {
          Alert.alert('Fehler', 'Eine Datei mit diesem Pfad existiert bereits.');
          return prev;
        }
        return {
          ...prev,
          files: [...prev.files, { path: validPath, content }],
        };
      });
    },
    [updateProject],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      await updateProject(prev => ({
        ...prev,
        files: prev.files.filter(f => f.path !== path),
      }));
    },
    [updateProject],
  );

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      // ✅ FIX: Top-level imports (bereits importiert)
      
      const pathValidation = validateFilePath(newPath);
      if (!pathValidation.valid) {
        Alert.alert(
          'Ungültiger Dateipfad',
          pathValidation.errors.join('\n')
        );
        return;
      }
      
      const validNewPath = pathValidation.normalized || newPath;
      
      await updateProject(prev => {
        if (prev.files.some(f => f.path === validNewPath)) {
          Alert.alert(
            'Fehler',
            'Eine Datei mit dem neuen Pfad existiert bereits.',
          );
          return prev;
        }
        return {
          ...prev,
          files: prev.files.map(f =>
            f.path === oldPath ? { ...f, path: validNewPath } : f,
          ),
        };
      });
    },
    [updateProject],
  );

  useEffect(() => {
    const initializeProject = async () => {
      try {
        console.log('APP START (Context V15 - ALL CRITICAL FIXES APPLIED)');
        const savedProject = await loadProjectFromStorage();
        if (savedProject) {
          console.log('📖 Projekt geladen:', savedProject.name);
          if (!savedProject.files) savedProject.files = [];
          if (!savedProject.chatHistory) {
            savedProject.chatHistory = [];
          }
          setProjectData(savedProject);
        } else {
          console.log('Kein Projekt gefunden, lade neues Template...');
          const templateFiles = await loadTemplateFromFile();
          const newProject: ProjectData = {
            id: uuidv4(),
            name: 'Neues Projekt',
            slug: 'neues-projekt',
            files: templateFiles,
            chatHistory: [],
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          };
          setProjectData(newProject);
          await saveProjectToStorage(newProject);
          console.log('Neues Template-Projekt erstellt und gespeichert.');
        }
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeProject();
  }, []);

  // ✅ FIX: Force-Flush debounced save bei App Background/Inactive
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        console.log('🔄 App geht in Background, flushe ausstehende Saves...');
        
        // Cancel pending debounce
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        
        // Force save current state
        if (projectData) {
          try {
            await saveProjectToStorage(projectData);
            console.log('✅ Background-Save erfolgreich');
          } catch (error) {
            console.error('❌ Background-Save fehlgeschlagen:', error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [projectData]);

  const value: ProjectContextProps = {
    projectData,
    isLoading,
    updateProjectFiles,
    addChatMessage,
    getGitHubToken,
    getWorkflowRuns,
    createFile,
    deleteFile,
    renameFile,
    setPackageName,
    exportProjectAsZip,
    importProjectFromZip,
    createNewProject,
    setProjectName,
    // Chat-Array für Screens
    messages: projectData?.chatHistory?.filter(msg => msg && msg.id) || [],
    // Für BuildScreen (Dummy-Implementierung bleibt, bis EAS-Flow final ist)
    exportAndBuild: async () => {
      Alert.alert('Fehler', 'exportAndBuild ist veraltet.');
      return null;
    },
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextProps => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
