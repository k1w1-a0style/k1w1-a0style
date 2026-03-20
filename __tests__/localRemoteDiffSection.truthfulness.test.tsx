import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { LocalRemoteDiffSection } from "../screens/GitHubReposScreen/components/LocalRemoteDiffSection";

const mockGetRepoFileText = jest.fn();
const mockListRepoBlobPaths = jest.fn();
const mockSetStringAsync = jest.fn(async (_value: string) => undefined);

jest.mock("expo-clipboard", () => ({
  setStringAsync: (value: string) => mockSetStringAsync(value),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../infra/github/githubService", () => ({
  getRepoFileText: (...args: unknown[]) => mockGetRepoFileText(...args),
  listRepoBlobPaths: (...args: unknown[]) => mockListRepoBlobPaths(...args),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderSection(props?: Partial<React.ComponentProps<typeof LocalRemoteDiffSection>>) {
  return render(
    <LocalRemoteDiffSection
      activeRepo="owner/repo-a"
      activeBranch="main"
      projectFiles={[{ path: "shared.ts", content: "local repo-a" }]}
      onPushSelected={jest.fn()}
      {...props}
    />,
  );
}

describe("LocalRemoteDiffSection truthfulness", () => {
  beforeEach(() => {
    mockGetRepoFileText.mockReset();
    mockListRepoBlobPaths.mockReset();
    mockSetStringAsync.mockClear();
    mockListRepoBlobPaths.mockResolvedValue([]);
  });

  it("blocks stale diff loads from an old repo/branch after a context switch", async () => {
    const oldLoad = createDeferred<string>();

    mockGetRepoFileText.mockImplementation(({ repo, path }: { repo: string; path: string }) => {
      if (repo === "repo-a" && path === "old.ts") return oldLoad.promise;
      if (repo === "repo-b" && path === "fresh.ts") return Promise.resolve("remote fresh");
      throw new Error(`Unexpected getRepoFileText call for ${repo}/${path}`);
    });

    const screen = renderSection({
      projectFiles: [{ path: "old.ts", content: "local old" }],
    });

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));

    screen.rerender(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-b"
        activeBranch="develop"
        projectFiles={[{ path: "fresh.ts", content: "local fresh" }]}
        onPushSelected={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));

    await waitFor(() => {
      expect(screen.getByText("fresh.ts")).toBeTruthy();
    });

    await act(async () => {
      oldLoad.resolve("remote old");
      await oldLoad.promise;
    });
    await flushMicrotasks();

    expect(screen.queryByText("old.ts")).toBeNull();
    expect(screen.getByText("fresh.ts")).toBeTruthy();
    expect(screen.getByText("Push (1)")).toBeTruthy();
  });

  it("does not blindly reuse preview cache across repo changes", async () => {
    mockGetRepoFileText.mockImplementation(({ repo, path }: { repo: string; path: string }) => {
      if (path !== "shared.ts") throw new Error(`Unexpected path ${path}`);
      if (repo === "repo-a") return Promise.resolve("remote repo-a");
      if (repo === "repo-b") return Promise.resolve("remote repo-b");
      throw new Error(`Unexpected repo ${repo}`);
    });

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("shared.ts"));
    await waitFor(() => {
      expect(screen.getByText("+ remote repo-a")).toBeTruthy();
    });

    screen.rerender(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-b"
        activeBranch="main"
        projectFiles={[{ path: "shared.ts", content: "local repo-b" }]}
        onPushSelected={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("shared.ts"));
    await waitFor(() => {
      expect(screen.getByText("+ remote repo-b")).toBeTruthy();
    });

    expect(screen.queryByText("+ remote repo-a")).toBeNull();
    expect(mockGetRepoFileText).toHaveBeenCalledTimes(4);
  });

  it("resets selection, inline expansion and previews on repo/branch changes", async () => {
    mockGetRepoFileText.mockImplementation(({ repo, path }: { repo: string; path: string }) => {
      if (repo === "repo-a" && path === "shared.ts") return Promise.resolve("remote repo-a");
      if (repo === "repo-b" && path === "fresh.ts") return Promise.resolve("remote repo-b");
      throw new Error(`Unexpected getRepoFileText call for ${repo}/${path}`);
    });

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
      expect(screen.getByText("Push (1)")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("shared.ts"));
    await waitFor(() => {
      expect(screen.getByText("Diff kopieren")).toBeTruthy();
      expect(screen.getByText("+ remote repo-a")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Details"));
    await waitFor(() => {
      expect(screen.getByText("Unified Diff")).toBeTruthy();
    });

    screen.rerender(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-b"
        activeBranch="develop"
        projectFiles={[{ path: "fresh.ts", content: "local repo-b" }]}
        onPushSelected={jest.fn()}
      />,
    );

    await flushMicrotasks();

    expect(screen.queryByText("shared.ts")).toBeNull();
    expect(screen.queryByText("Diff kopieren")).toBeNull();
    expect(screen.queryByText("Unified Diff")).toBeNull();
    expect(screen.getByText("Push (0)")).toBeTruthy();
  });

  it("prevents stale modal or inline previews from showing old diffs after a context switch", async () => {
    const previewDeferred = createDeferred<string>();

    mockGetRepoFileText.mockImplementation(({ repo, path }: { repo: string; path: string }) => {
      if (repo === "repo-a" && path === "shared.ts") {
        return mockGetRepoFileText.mock.calls.length <= 1 ? Promise.resolve("remote repo-a") : previewDeferred.promise;
      }
      if (repo === "repo-b" && path === "fresh.ts") return Promise.resolve("remote repo-b");
      throw new Error(`Unexpected getRepoFileText call for ${repo}/${path}`);
    });

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Inline"));
    fireEvent.press(screen.getByText("shared.ts"));

    await waitFor(() => {
      expect(screen.getByText("Lade Diff…")).toBeTruthy();
    });

    screen.rerender(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-b"
        activeBranch="develop"
        projectFiles={[{ path: "fresh.ts", content: "local repo-b" }]}
        onPushSelected={jest.fn()}
      />,
    );

    await act(async () => {
      previewDeferred.resolve("late remote repo-a");
      await previewDeferred.promise;
    });
    await flushMicrotasks();

    expect(screen.queryByText("late remote repo-a")).toBeNull();
    expect(screen.queryByText("+ late remote repo-a")).toBeNull();
    expect(screen.queryByText("shared.ts")).toBeNull();
    expect(screen.queryByText("Lade Diff…")).toBeNull();
  });

  it("keeps the normal diff flow working inside the same repo/branch context", async () => {
    mockGetRepoFileText.mockResolvedValue("remote repo-a");

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
      expect(screen.getByText("Push (1)")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("shared.ts"));
    await waitFor(() => {
      expect(screen.getByText("+ remote repo-a")).toBeTruthy();
      expect(screen.getByText("- local repo-a")).toBeTruthy();
    });
  });
});
