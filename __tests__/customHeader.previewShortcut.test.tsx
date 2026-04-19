import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import CustomHeader from "../components/CustomHeader";

const mockUseGitHub = jest.fn();
const mockUseProject = jest.fn();
const mockUseSafeAreaInsets = jest.fn();

const createNavigation = () => {
  const parentNavigate = jest.fn();
  const drawerNavigate = jest.fn();
  return {
    openDrawer: jest.fn(),
    navigate: drawerNavigate,
    getParent: () => ({ navigate: parentNavigate }),
    __parentNavigate: parentNavigate,
    __drawerNavigate: drawerNavigate,
  };
};

jest.mock("../contexts/GitHubContext", () => ({
  useGitHub: () => mockUseGitHub(),
}));

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockUseSafeAreaInsets(),
}));

jest.mock("../components/ChatHeaderActions", () => () => null);
jest.mock("../components/CiLiteHeaderButton", () => () => null);

describe("CustomHeader preview shortcut", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGitHub.mockReturnValue({ activeRepo: "owner/repo", activeBranch: "main" });
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, left: 0, right: 0, bottom: 0 });
  });

  it("opens fullscreen preview when a valid last preview exists", () => {
    const navigation = createNavigation();
    mockUseProject.mockReturnValue({
      projectData: {
        name: "Demo App",
        lastPreview: {
          url: "https://example.com/preview",
          expiresAt: "2999-01-01T00:00:00.000Z",
        },
      },
      isRecoveryMode: false,
      recoveryModeReason: null,
    });

    const screen = render(
      <CustomHeader
        navigation={navigation as never}
        options={{ title: "Header" } as never}
        route={{ key: "x", name: "Home" } as never}
        layout={{ height: 0, width: 0 } as never}
      />,
    );

    fireEvent.press(screen.getByLabelText("Preview"));

    expect(navigation.__parentNavigate).toHaveBeenCalledWith("PreviewFullscreen", {
      url: "https://example.com/preview",
      title: "Demo App",
    });
    expect(navigation.__drawerNavigate).not.toHaveBeenCalled();
  });

  it("falls back to Preview screen when no valid preview exists", () => {
    const navigation = createNavigation();
    mockUseProject.mockReturnValue({
      projectData: {
        name: "Demo App",
        lastPreview: null,
      },
      isRecoveryMode: false,
      recoveryModeReason: null,
    });

    const screen = render(
      <CustomHeader
        navigation={navigation as never}
        options={{ title: "Header" } as never}
        route={{ key: "x", name: "Home" } as never}
        layout={{ height: 0, width: 0 } as never}
      />,
    );

    fireEvent.press(screen.getByLabelText("Preview"));

    expect(navigation.__drawerNavigate).toHaveBeenCalledWith("Preview");
    expect(navigation.__parentNavigate).not.toHaveBeenCalled();
  });
});