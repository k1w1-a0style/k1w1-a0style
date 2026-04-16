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
  const mockAlertChoice = (choiceIndex: number): void => {
    (Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
      const btn = Array.isArray(buttons) ? buttons[choiceIndex] : undefined;
      btn?.onPress?.();
    });
  };

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

  it("does not overwrite local unsaved edits when there is no external file change", async () => {
    const { result, rerender } = renderHook(() => useFileEditor());

    await act(async () => {
      result.current.setSelectedFile({ path: "App.tsx", content: "persisted" });
      result.current.setEditingContent("local unsaved typing");
    });

    // Re-render without any project-file mutation.
    rerender({});

    expect(result.current.editingContent).toBe("local unsaved typing");
    expect(result.current.isDirty).toBe(true);
  });

  it("retains local draft when selected file is deleted externally", async () => {
    const { result, rerender } = renderHook(() => useFileEditor());

    await act(async () => {
      result.current.setSelectedFile({ path: "App.tsx", content: "old" });
      result.current.setEditingContent("local unsaved draft");
    });

    contextState.projectData = { files: [] };
    rerender({});

    expect(result.current.selectedFile?.path).toBe("App.tsx");
    expect(result.current.editingContent).toBe("local unsaved draft");
    expect(result.current.isDirty).toBe(true);
  });

  it("blocks save after external deletion unless user explicitly restores draft", async () => {
    const { result, rerender } = renderHook(() => useFileEditor());

    await act(async () => {
      result.current.setSelectedFile({ path: "App.tsx", content: "old" });
      result.current.setEditingContent("changed");
    });

    contextState.projectData = { files: [] };
    rerender({});

    mockAlertChoice(0);
    let saved = true;
    await act(async () => {
      saved = await result.current.saveSelectedFile();
    });

    expect(saved).toBe(false);
    expect(updateProjectFiles).not.toHaveBeenCalled();
  });

  it("detects external change conflict and does not silently overwrite by default", async () => {
    const { result, rerender } = renderHook(() => useFileEditor());

    await act(async () => {
      result.current.setSelectedFile({ path: "App.tsx", content: "base" });
      result.current.setEditingContent("local draft");
    });

    contextState.projectData = {
      files: [{ path: "App.tsx", content: "external change" }],
    };
    rerender({});

    mockAlertChoice(0);
    let saved = true;
    await act(async () => {
      saved = await result.current.saveSelectedFile();
    });

    expect(saved).toBe(false);
    expect(updateProjectFiles).not.toHaveBeenCalled();
  });
});
