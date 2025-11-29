// contexts/ProjectContext.tsx (V13 - CREATE NEW PROJECT FIX)
import { v4 as uuidv4 } from 'uuid';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
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

export { getGitHubToken, saveGitHubToken, saveExpoToken, getExpoToken } from './githubService';

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback((project: ProjectData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveProjectToStorage(project);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const updateProject = useCallback(
    (updater: (prev: ProjectData) => ProjectData) => {
      setProjectData(prev => {
        if (!prev) return prev;
        const updated = updater(prev);
        const finalProject = { ...updated, lastModified: new Date().toISOString() };
        debouncedSave(finalProject);
        return finalProject;
      });
    },
    [debouncedSave],
  );

  // ✅ FIX: MERGE statt OVERWRITE!
  const updateProjectFiles = useCallback(
    async (files: ProjectFile[], newName?: string) => {
      updateProject(prev => {
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
    (newName: string) => {
      updateProject(prev => ({
        ...prev,
        name: newName,
      }));
    },
    [updateProject],
  );

  const addChatMessage = useCallback(
    (message: ChatMessage) => {
      updateProject(prev => ({
        ...prev,
        chatHistory: [...(prev.chatHistory || []), message],
      }));
    },
    [updateProject],
  );

  const setPackageName = useCallback(
    (packageName: string) => {
      updateProject(prev => ({
        ...prev,
        packageName,
      }));
    },
    [updateProject],
  );

  // ✅ NEU: Neues Projekt erstellen
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
              setProjectData(newProject);
              await saveProjectToStorage(newProject);
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
              setProjectData(result.project);
              await saveProjectToStorage(result.project);
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
      if (!path.trim()) {
        Alert.alert('Fehler', 'Dateiname darf nicht leer sein.');
        return;
      }
      updateProject(prev => {
        if (prev.files.some(f => f.path === path)) {
          Alert.alert('Fehler', 'Eine Datei mit diesem Pfad existiert bereits.');
          return prev;
        }
        return {
          ...prev,
          files: [...prev.files, { path, content }],
        };
      });
    },
    [updateProject],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      updateProject(prev => ({
        ...prev,
        files: prev.files.filter(f => f.path !== path),
      }));
    },
    [updateProject],
  );

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      if (!newPath.trim()) {
        Alert.alert('Fehler', 'Neuer Dateiname darf nicht leer sein.');
        return;
      }
      updateProject(prev => {
        if (prev.files.some(f => f.path === newPath)) {
          Alert.alert(
            'Fehler',
            'Eine Datei mit dem neuen Pfad existiert bereits.',
          );
          return prev;
        }
        return {
          ...prev,
          files: prev.files.map(f =>
            f.path === oldPath ? { ...f, path: newPath } : f,
          ),
        };
      });
    },
    [updateProject],
  );

  useEffect(() => {
    const initializeProject = async () => {
      try {
        console.log('APP START (Context V13 - CREATE NEW PROJECT)');
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
