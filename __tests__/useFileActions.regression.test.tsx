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
  const deleteFile = jest.fn<Promise<{ status: string; changed: boolean; reason?: string }>, [string]>(
    async () => ({ status: "success", changed: true }),
  );
  const deleteFiles = jest.fn<Promise<{ status: string; changed: boolean; reason?: string }>, [string[]]>(
    async () => ({ status: "success", changed: true }),
  );

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
      createFile: jest.fn(async () => undefined),
      deleteFile,
      deleteFiles,
      renameFile: jest.fn(async () => undefined),
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

  test("folder delete keeps editor selection when deleteFiles is noop", async () => {
    deleteFiles.mockResolvedValueOnce({ status: "noop", changed: false, reason: "not_found" });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_, __, buttons) => {
      const destructive = buttons?.find((btn) => btn.style === "destructive" && btn.text === "Löschen");
      destructive?.onPress?.();
    });
    const setSelectedFile = jest.fn();
    const setEditingContent = jest.fn();
    const { result } = renderHook(() =>
      useFileActions({
        ...deps,
        selectedFile: { path: "src/a.ts", content: "a" },
        setSelectedFile,
        setEditingContent,
      }),
    );

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

    expect(deleteFiles).toHaveBeenCalledWith(["src/a.ts", "src/nested/b.ts"]);
    expect(setSelectedFile).not.toHaveBeenCalled();
    expect(setEditingContent).not.toHaveBeenCalled();
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
});
