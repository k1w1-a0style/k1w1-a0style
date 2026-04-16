// screens/CodeScreen/hooks/useFileEditor.ts
// Handles: selected file state, editing content, dirty tracking,
//          live syntax validation (deferred), and saving.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Alert, InteractionManager } from "react-native";

import { useProject } from "../../../contexts/ProjectContext";
import type { ProjectFile } from "../../../shared/types/project";
import { validateCodeQuality, validateSyntax } from "../../../utils/syntaxValidator";
import type { SyntaxError as ValidationError } from "../../../utils/syntaxValidator";


export type ViewMode = "edit" | "preview";

type AlertChoice<T extends string> = {
  text: string;
  value: T;
  style?: "default" | "cancel" | "destructive";
};

const alertAsync = <T extends string>(
  title: string,
  message: string,
  choices: ReadonlyArray<AlertChoice<T>>,
  fallback: T,
): Promise<T> =>
  new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (v: T): void => {
      if (resolved) return;
      resolved = true;
      resolve(v);
    };

    Alert.alert(
      title,
      message,
      choices.map((c) => ({
        text: c.text,
        style: c.style,
        onPress: () => safeResolve(c.value),
      })),
      { cancelable: true, onDismiss: () => safeResolve(fallback) },
    );
  });

export const toContentString = (file: ProjectFile): string =>
  typeof file.content === "string"
    ? file.content
    : JSON.stringify(file.content, null, 2);

const countLines = (s: string): number => {
  let n = 1;
  for (let i = 0; i < s.length; i += 1) {
    if (s.charCodeAt(i) === 10) n += 1;
  }
  return n;
};

export interface UseFileEditorReturn {
  selectedFile: ProjectFile | null;
  setSelectedFile: Dispatch<SetStateAction<ProjectFile | null>>;
  editingContent: string;
  setEditingContent: Dispatch<SetStateAction<string>>;
  isDirty: boolean;
  viewMode: ViewMode;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  syntaxErrors: ValidationError[];
  externalMutationState: "clean" | "externally_modified" | "externally_deleted";

  /** Save the selected file. Resolves `true` only if actually saved. */
  saveSelectedFile: () => Promise<boolean>;
  /** Fire-and-forget wrapper around `saveSelectedFile`. */
  handleSaveFile: () => void;
  /**
   * Guard helper: if there are unsaved changes, shows a confirmation dialog.
   * Otherwise calls `next()` immediately.
   */
  confirmLoseChanges: (next: () => void) => void;
}

const MAX_SAVE_VALIDATE_CHARS = 200_000;

export const useFileEditor = (): UseFileEditorReturn => {
  const { projectData, updateProjectFiles } = useProject();

  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [syntaxErrors, setSyntaxErrors] = useState<ValidationError[]>([]);
  const [externalMutationState, setExternalMutationState] = useState<
    "clean" | "externally_modified" | "externally_deleted"
  >("clean");
  const editingContentRef = useRef("");
  editingContentRef.current = editingContent;

  const selectedOriginalContent = useMemo(
    () => (selectedFile ? toContentString(selectedFile) : ""),
    [selectedFile],
  );

  const isDirty = useMemo(() => {
    if (!selectedFile) return false;
    return editingContent !== selectedOriginalContent;
  }, [editingContent, selectedFile, selectedOriginalContent]);

  useEffect(() => {
    if (!selectedFile) {
      setExternalMutationState("clean");
      return;
    }
    const liveFile = (projectData?.files ?? []).find((file) => file.path === selectedFile.path);
    if (!liveFile) {
      const previousSourceContent = toContentString(selectedFile);
      const currentEditorContent = editingContentRef.current;
      const hasLocalUnsavedEdits = currentEditorContent !== previousSourceContent;

      if (hasLocalUnsavedEdits) {
        setExternalMutationState("externally_deleted");
        return;
      }
      setExternalMutationState("clean");
      setSelectedFile(null);
      setEditingContent("");
      setSyntaxErrors([]);
      return;
    }
    const previousSourceContent = toContentString(selectedFile);
    const nextSourceContent = toContentString(liveFile);
    if (nextSourceContent === previousSourceContent) return;

    const currentEditorContent = editingContentRef.current;
    const hasLocalUnsavedEdits = currentEditorContent !== previousSourceContent;

    if (!hasLocalUnsavedEdits) {
      setExternalMutationState("clean");
      setSelectedFile({ ...liveFile });
      setEditingContent(nextSourceContent);
      return;
    }
    setExternalMutationState("externally_modified");
  }, [projectData?.files, selectedFile]);

  // Live validation (debounced + deferred via InteractionManager).
  useEffect(() => {
    if (!selectedFile || viewMode !== "edit") {
      setSyntaxErrors([]);
      return;
    }
    if (!editingContent.trim()) {
      setSyntaxErrors([]);
      return;
    }

    const len = editingContent.length;
    const lines = countLines(editingContent);

    const huge = len > 600_000;
    const large = len > 200_000 || lines > 5_000;

    if (huge) {
      // Huge files: skip validation entirely (avoid UI stalls).
      setSyntaxErrors([]);
      return;
    }

    const debounceMs = large ? 1500 : 500;
    const includeQuality = !large;

    let interactionHandle: { cancel: () => void } | null = null;

    const timeoutId = setTimeout(() => {
      interactionHandle = InteractionManager.runAfterInteractions(() => {
        try {
          const errors = [
            ...validateSyntax(editingContent, selectedFile.path),
            ...(includeQuality
              ? validateCodeQuality(editingContent, selectedFile.path)
              : []),
          ];
          setSyntaxErrors(errors);
        } catch {
          setSyntaxErrors([]);
        }
      });
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      interactionHandle?.cancel();
    };
  }, [editingContent, selectedFile, viewMode]);

  const saveSelectedFile = useCallback(async (): Promise<boolean> => {
    if (!selectedFile) return false;

    try {
      const liveFile = (projectData?.files ?? []).find((file) => file.path === selectedFile.path);
      const selectedOriginal = toContentString(selectedFile);
      const hasLocalUnsavedEdits = editingContent !== selectedOriginal;

      if (!liveFile) {
        const choice = await alertAsync(
          "Datei extern gelöscht",
          "Die Zieldatei wurde außerhalb des Editors gelöscht. Dein lokaler Entwurf bleibt erhalten. Neu anlegen und mit deinem Entwurf speichern?",
          [
            { text: "Abbrechen", value: "cancel" as const, style: "cancel" },
            { text: "Neu anlegen", value: "recreate" as const, style: "destructive" },
          ],
          "cancel",
        );
        if (choice !== "recreate") return false;
      }

      if (liveFile) {
        const liveContent = toContentString(liveFile);
        const hasExternalChange = liveContent !== selectedOriginal;
        if (hasExternalChange && hasLocalUnsavedEdits) {
          const choice = await alertAsync(
            "Konflikt erkannt",
            "Diese Datei wurde extern geändert, während du lokale Änderungen hast. Externe Änderung laden oder bewusst überschreiben?",
            [
              { text: "Abbrechen", value: "cancel" as const, style: "cancel" },
              { text: "Extern laden", value: "load_external" as const },
              { text: "Trotzdem überschreiben", value: "overwrite" as const, style: "destructive" },
            ],
            "cancel",
          );
          if (choice === "load_external") {
            setSelectedFile({ ...liveFile });
            setEditingContent(liveContent);
            setExternalMutationState("clean");
          }
          if (choice !== "overwrite") return false;
        }
      }

      if (editingContent.length > MAX_SAVE_VALIDATE_CHARS) {
        const choice = await alertAsync(
          "Datei sehr groß",
          "Diese Datei ist sehr groß. Ein Syntax-Check kann auf Android kurz hängen oder langsam sein. Ohne Syntax-Check speichern?",
          [
            { text: "Abbrechen", value: "cancel" as const, style: "cancel" },
            {
              text: "Ohne Check speichern",
              value: "save" as const,
              style: "destructive",
            },
          ],
          "cancel",
        );

        if (choice !== "save") return false;
      }

      if (editingContent.length <= MAX_SAVE_VALIDATE_CHARS) {
        const errors = validateSyntax(editingContent, selectedFile.path);
        const critical = errors.filter((e) => e.severity === "error");

        if (critical.length > 0) {
          const list = critical.map((e) => `• ${e.message}`).join("\n");

          const choice = await alertAsync(
            "Syntax-Fehler",
            `Die folgenden Fehler wurden gefunden:\n\n${list}\n\nTrotzdem speichern?`,
            [
              { text: "Abbrechen", value: "cancel" as const, style: "cancel" },
              {
                text: "Trotzdem speichern",
                value: "save" as const,
                style: "destructive",
              },
            ],
            "cancel",
          );

          if (choice !== "save") return false;
        }
      }
      await updateProjectFiles([
        { path: selectedFile.path, content: editingContent },
      ]);
      setExternalMutationState("clean");
      setSelectedFile((prev) =>
        prev ? { ...prev, content: editingContent } : null,
      );

      Alert.alert("✅ Gespeichert", selectedFile.path);
      return true;
    } catch {
      Alert.alert("Fehler", "Datei konnte nicht gespeichert werden.");
      return false;
    }
  }, [editingContent, projectData?.files, selectedFile, updateProjectFiles]);

  const handleSaveFile = useCallback(() => {
    void saveSelectedFile();
  }, [saveSelectedFile]);

  const confirmLoseChanges = useCallback(
    (next: () => void) => {
      if (!isDirty) {
        next();
        return;
      }

      Alert.alert(
        "Ungespeicherte Änderungen",
        "Du hast Änderungen, die noch nicht gespeichert sind. Was soll passieren?",
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Verwerfen",
            style: "destructive",
            onPress: next,
          },
          {
            text: "Speichern",
            onPress: () => {
              void (async () => {
                const saved = await saveSelectedFile();
                if (saved) next();
              })();
            },
          },
        ],
      );
    },
    [isDirty, saveSelectedFile],
  );

  return {
    selectedFile,
    setSelectedFile,
    editingContent,
    setEditingContent,
    isDirty,
    viewMode,
    setViewMode,
    syntaxErrors,
    externalMutationState,
    saveSelectedFile,
    handleSaveFile,
    confirmLoseChanges,
  };
};
