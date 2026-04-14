import { renderHook, act } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useFileActions } from "../screens/CodeScreen/hooks/useFileActions";
import type { FileActionsDeps } from "../screens/CodeScreen/hooks/useFileActions";
import type { TreeNode } from "../components/FileTree";

const mockUseProject = jest.fn();

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

describe("useFileActions regressions", () => {
  const deleteFile = jest.fn(async () => ({ status: "success" as const }));
  const deleteFiles = jest.fn(async () => ({ status: "success" as const }));

  const deps: FileActionsDeps = {
    selectedFile: null,
    setSelectedFile: jest.fn(),
    setEditingContent: jest.fn(),
    setViewMode: jest.fn(),
    confirmLoseChanges: (next) => next(),
    selectionMode: false,
    toggleFileSelection: jest.fn(),
    currentFolderPath: "",
    setCurrentFolderPath: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProject.mockReturnValue({
      projectData: {
        files: [
          { path: "src/a.ts", content: "a" },
          { path: "src/nested/b.ts", content: "b" },
          { path: "other/c.ts", content: "c" },
        ],
      },
      createFile: jest.fn(async () => ({ status: "success" as const })),
      deleteFile,
      deleteFiles,
      renameFile: jest.fn(async () => ({ status: "success" as const })),
    });
  });

  test("folder delete batches paths via deleteFiles", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_, __, buttons) => {
      const destructive = buttons?.find((btn) => btn.style === "destructive" && btn.text === "Löschen");
      destructive?.onPress?.();
    });

    const { result } = renderHook(() => useFileActions(deps));

    const folderNode: TreeNode = {
      id: "folder_src",
      name: "src",
      path: "src",
      type: "folder",
      children: [],
    };

    act(() => {
      result.current.handleItemLongPress(folderNode);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(deleteFiles).toHaveBeenCalledTimes(1);
    expect(deleteFiles).toHaveBeenCalledWith(["src/a.ts", "src/nested/b.ts"]);
    expect(deleteFile).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test("handleDeleteFile shows explicit guard alert when target is missing", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const { result } = renderHook(() => useFileActions(deps));

    await act(async () => {
      await result.current.handleDeleteFile();
    });

    expect(deleteFile).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Fehler", "Keine Datei zum Löschen ausgewählt.");
    alertSpy.mockRestore();
  });

  test("handleCreateFile does not switch selection when createFile returns noop", async () => {
    const setSelectedFile = jest.fn();
    const setEditingContent = jest.fn();
    const setViewMode = jest.fn();

    mockUseProject.mockReturnValue({
      projectData: { files: [] },
      createFile: jest.fn(async () => ({ status: "noop", message: "already exists" })),
      deleteFile,
      deleteFiles,
      renameFile: jest.fn(async () => ({ status: "success" as const })),
    });

    const { result } = renderHook(() =>
      useFileActions({
        ...deps,
        setSelectedFile,
        setEditingContent,
        setViewMode,
      }),
    );

    await act(async () => {
      await result.current.handleCreateFile("App.tsx");
    });

    expect(setSelectedFile).not.toHaveBeenCalled();
    expect(setEditingContent).not.toHaveBeenCalled();
    expect(setViewMode).not.toHaveBeenCalled();
  });

  test("handleCreateFile does not switch selection when result is undefined", async () => {
    const setSelectedFile = jest.fn();
    const setEditingContent = jest.fn();
    const setViewMode = jest.fn();

    mockUseProject.mockReturnValue({
      projectData: { files: [] },
      createFile: jest.fn(async () => undefined),
      deleteFile,
      deleteFiles,
      renameFile: jest.fn(async () => ({ status: "success" as const })),
    });

    const { result } = renderHook(() =>
      useFileActions({
        ...deps,
        setSelectedFile,
        setEditingContent,
        setViewMode,
      }),
    );

    await act(async () => {
      await result.current.handleCreateFile("App.tsx");
    });

    expect(setSelectedFile).not.toHaveBeenCalled();
    expect(setEditingContent).not.toHaveBeenCalled();
    expect(setViewMode).not.toHaveBeenCalled();
  });

  test("handleDeleteFile keeps open editor state when deleteFile returns noop", async () => {
    const setSelectedFile = jest.fn();
    const setEditingContent = jest.fn();
    const deleteFileNoop = jest.fn(async () => ({ status: "noop", message: "missing" }));

    mockUseProject.mockReturnValue({
      projectData: { files: [{ path: "src/a.ts", content: "a" }] },
      createFile: jest.fn(async () => ({ status: "success" as const })),
      deleteFile: deleteFileNoop,
      deleteFiles,
      renameFile: jest.fn(async () => ({ status: "success" as const })),
    });

    const { result } = renderHook(() =>
      useFileActions({
        ...deps,
        selectedFile: { path: "src/a.ts", content: "a" },
        setSelectedFile,
        setEditingContent,
      }),
    );

    act(() => {
      result.current.setActionTargetFile({ path: "src/a.ts", content: "a" });
    });

    await act(async () => {
      await result.current.handleDeleteFile();
    });

    expect(deleteFileNoop).toHaveBeenCalledWith("src/a.ts");
    expect(setSelectedFile).not.toHaveBeenCalled();
    expect(setEditingContent).not.toHaveBeenCalled();
  });

  test("folder delete fallback merges per-file results instead of assuming success", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_, __, buttons) => {
      const destructive = buttons?.find((btn) => btn.style === "destructive" && btn.text === "Löschen");
      destructive?.onPress?.();
    });
    const deleteFileFallback = jest
      .fn()
      .mockResolvedValueOnce({ status: "noop", message: "missing a" })
      .mockResolvedValueOnce({ status: "rejected", message: "blocked b" });

    mockUseProject.mockReturnValue({
      projectData: {
        files: [
          { path: "src/a.ts", content: "a" },
          { path: "src/nested/b.ts", content: "b" },
        ],
      },
      createFile: jest.fn(async () => ({ status: "success" as const })),
      deleteFile: deleteFileFallback,
      deleteFiles: undefined,
      renameFile: jest.fn(async () => ({ status: "success" as const })),
    });

    const { result } = renderHook(() => useFileActions(deps));
    act(() => {
      result.current.handleItemLongPress({
        id: "folder_src",
        name: "src",
        path: "src",
        type: "folder",
        children: [],
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(deleteFileFallback).toHaveBeenCalledTimes(2);
    expect(alertSpy).toHaveBeenCalledWith(
      "Fehler",
      expect.stringContaining("Mindestens eine Dateioperation wurde abgelehnt."),
    );
    alertSpy.mockRestore();
  });
});
