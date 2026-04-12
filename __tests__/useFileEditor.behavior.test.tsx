import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useFileEditor } from "../screens/CodeScreen/hooks/useFileEditor";
import type { ProjectFile } from "../shared/types/project";

const updateProjectFiles = jest.fn(async () => undefined);

const contextState: {
  projectData: { files: ProjectFile[] };
  updateProjectFiles: typeof updateProjectFiles;
} = {
  projectData: { files: [] },
  updateProjectFiles,
};

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => contextState,
}));

describe("useFileEditor behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextState.projectData = {
      files: [{ path: "App.tsx", content: "export default function App(){ return null; }" }],
    };
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
  });

  it("resyncs editor content when selected file changes externally", async () => {
    const { result, rerender } = renderHook(() => useFileEditor());

    await act(async () => {
      result.current.setSelectedFile({ path: "App.tsx", content: "old" });
      result.current.setEditingContent("old");
    });

    contextState.projectData = {
      files: [{ path: "App.tsx", content: "new external content" }],
    };

    rerender({});

    expect(result.current.editingContent).toBe("new external content");
    expect(result.current.selectedFile?.content).toBe("new external content");
  });

  it("clears editor state when selected file is deleted externally", async () => {
    const { result, rerender } = renderHook(() => useFileEditor());

    await act(async () => {
      result.current.setSelectedFile({ path: "App.tsx", content: "old" });
      result.current.setEditingContent("old");
    });

    contextState.projectData = { files: [] };
    rerender({});

    expect(result.current.selectedFile).toBeNull();
    expect(result.current.editingContent).toBe("");
  });

  it("does not recreate deleted file on save", async () => {
    const { result, rerender } = renderHook(() => useFileEditor());

    await act(async () => {
      result.current.setSelectedFile({ path: "App.tsx", content: "old" });
      result.current.setEditingContent("changed");
    });

    contextState.projectData = { files: [] };
    rerender({});

    let saved = true;
    await act(async () => {
      saved = await result.current.saveSelectedFile();
    });

    expect(saved).toBe(false);
    expect(updateProjectFiles).not.toHaveBeenCalled();
  });
});
