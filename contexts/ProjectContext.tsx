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
import {
  ProjectData,
  ProjectFile,
  ChatMessage,
  ProjectContextProps,
} from './types';
import {
  saveProjectToStorage,
  loadProjectFromStorage,
  exportProjectAsZipFile,
  importProjectFromZipFile,
} from './projectStorage';
import { getGitHubToken, getWorkflowRuns } from './githubService';

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
const ProjectContext = createContext<ProjectContextProps | undefined>(
  undefined,
);

export {
  getGitHubToken,
  saveGitHubToken,
  saveExpoToken,
  getExpoToken,
} from './githubService';

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const finalProject: ProjectData = {
          ...updated,
          lastModified: new Date().toISOString(),
        };

        debouncedSave(finalProject);
        return finalProject;
      });
    },
    [debouncedSave],
  );

  // ✅ Files im Projekt mergen (kein Overwrite)
  const updateProjectFiles = useCallback(
    async (files: ProjectFile[], newName?: string) => {
      updateProject(prev => {
        const fileMap = new Map<string, ProjectFile>(
          prev.files.map(f => [f.path, f]),
        );

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
        // @ts-ignore – ProjectData kann packageName optional enthalten
        packageName,
      }));
    },
    [updateProject],
  );

  // File-Ops
  const createFile = useCallback(
    async (path: string, content: string) => {
      updateProject(prev => {
        const without = prev.files.filter(f => f.path !== path);
        return {
          ...prev,
          files: [...without, { path, content }],
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

  const updateFileContent = useCallback(
    async (path: string, content: string) => {
      updateProject(prev => ({
        ...prev,
        files: prev.files.map(f =>
          f.path === path ? { ...f, content } : f,
        ),
      }));
    },
    [updateProject],
  );

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      updateProject(prev => ({
        ...prev,
        files: prev.files.map(f =>
          f.path === oldPath ? { ...f, path: newPath } : f,
        ),
      }));
    },
    [updateProject],
  );

  // ✅ Neues Projekt erstellen (mit Template)
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
              const now = new Date().toISOString();
              const newProject: ProjectData = {
                id: uuidv4(),
                name: 'Neues Projekt',
                slug: 'neues-projekt',
                files: templateFiles,
                chatHistory: [],
                createdAt: now,
                lastModified: now,
              };

              setProjectData(newProject);
              await saveProjectToStorage(newProject);
              console.log(
                'Neues Template-Projekt erstellt und gespeichert.',
              );
            } catch (error) {
              console.error('Fehler beim Erstellen eines neuen Projekts:', error);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  }, []);

  // Export/Import-Wrapper
  const exportProjectAsZip = useCallback(async () => {
    if (!projectData) {
      Alert.alert('Fehler', 'Kein Projekt geladen.');
      return;
    }
    try {
      await exportProjectAsZipFile(projectData);
    } catch (error: any) {
      console.error('Fehler beim Export:', error);
      Alert.alert('Fehler', error.message || 'ZIP-Export fehlgeschlagen');
    }
  }, [projectData]);

  const importProjectFromZip = useCallback(async () => {
    try {
      const result = await importProjectFromZipFile();
      setProjectData(result.project);
      await saveProjectToStorage(result.project);
    } catch (error: any) {
      console.error('Fehler beim Import:', error);
      Alert.alert('Fehler', error.message || 'ZIP-Import fehlgeschlagen');
    }
  }, []);

  // Initiales Laden
  useEffect(() => {
    let isMounted = true;

    const initializeProject = async () => {
      try {
        const stored = await loadProjectFromStorage();
        if (stored && isMounted) {
          setProjectData(stored);
          console.log('Projekt aus Storage geladen.');
          return;
        }

        // Fallback: Template
        const templateFiles = await loadTemplateFromFile();
        const now = new Date().toISOString();
        const newProject: ProjectData = {
          id: uuidv4(),
          name: 'Neues Projekt',
          slug: 'neues-projekt',
          files: templateFiles,
          chatHistory: [],
          createdAt: now,
          lastModified: now,
        };

        if (isMounted) {
          setProjectData(newProject);
          await saveProjectToStorage(newProject);
          console.log('Neues Template-Projekt erstellt und gespeichert.');
        }
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeProject();

    return () => {
      isMounted = false;
    };
  }, []);

  const value: ProjectContextProps = {
    projectData,
    isLoading,
    updateProjectFiles,
    createFile,
    deleteFile,
    updateFileContent,
    renameFile,
    setPackageName,
    setProjectName,
    createNewProject,

    // Chat-Array für Screens
    addChatMessage,
    messages:
      projectData?.chatHistory?.filter(
        (msg): msg is ChatMessage =>
          Boolean(msg && (msg as ChatMessage).id),
      ) || [],

    // Export/Import
    exportAndBuild: async () => {
      Alert.alert('Fehler', 'exportAndBuild ist veraltet.');
      return null;
    },
    exportProjectAsZip,
    importProjectFromZip,
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
