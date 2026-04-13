import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

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

async function waitForContextReset(
  screen: ReturnType<typeof render>,
  expectedContextLabel: string,
) {
  await waitFor(() => {
    expect(screen.getByText(expectedContextLabel)).toBeTruthy();
    expect(screen.getByText("Push (0)")).toBeTruthy();
    expect(screen.getByTestId("local-remote-diff-refresh").props.disabled).not.toBe(true);
  });
}

describe("LocalRemoteDiffSection truthfulness", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockGetRepoFileText.mockReset();
    mockListRepoBlobPaths.mockReset();
    mockSetStringAsync.mockClear();
    mockListRepoBlobPaths.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.clearAllMocks();
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

    await flushMicrotasks();
    await waitForContextReset(screen, "owner/repo-b@develop • Lokal: 1 Dateien");

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

    await waitForContextReset(screen, "owner/repo-b@main • Lokal: 1 Dateien");

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


  it("ignores late diff loads after unmount", async () => {
    const deferred = createDeferred<string>();

    mockGetRepoFileText.mockImplementation(({ repo, path }: { repo: string; path: string }) => {
      if (repo === "repo-a" && path === "shared.ts") return deferred.promise;
      throw new Error(`Unexpected getRepoFileText call for ${repo}/${path}`);
    });

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    screen.unmount();

    await act(async () => {
      deferred.resolve("remote repo-a");
      await deferred.promise;
    });
    await flushMicrotasks();

    expect(mockGetRepoFileText).toHaveBeenCalledTimes(1);
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


  it("invalidates stale diff items when local files change inside the same repo/branch context", async () => {
    mockGetRepoFileText.mockResolvedValue("remote repo-a");

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
      expect(screen.getByText("Push (1)")).toBeTruthy();
    });

    screen.rerender(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-a"
        activeBranch="main"
        projectFiles={[{ path: "shared.ts", content: "local repo-a updated" }]}
        onPushSelected={jest.fn()}
      />,
    );

    await flushMicrotasks();

    expect(screen.queryByText("shared.ts")).toBeNull();
    expect(screen.getByText("Lokale Dateien wurden geändert. Vergleich neu laden.")).toBeTruthy();
    expect(screen.getByText("Drück Refresh für einen Vergleich (lokale Dateien gegen GitHub Datei-Inhalt).")).toBeTruthy();
  });

  it("clears stale push selection when local files change inside the same repo/branch context", async () => {
    mockGetRepoFileText.mockResolvedValue("remote repo-a");

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("Push (1)")).toBeTruthy();
    });

    screen.rerender(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-a"
        activeBranch="main"
        projectFiles={[{ path: "shared.ts", content: "local repo-a updated" }]}
        onPushSelected={jest.fn()}
      />,
    );

    await flushMicrotasks();

    expect(screen.getByText("Push (0)")).toBeTruthy();
    expect(screen.queryByText("push")).toBeNull();
  });

  it("drops open preview content and preview cache when local files change inside the same repo/branch context", async () => {
    mockGetRepoFileText.mockResolvedValue("remote repo-a");

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
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
        activeRepo="owner/repo-a"
        activeBranch="main"
        projectFiles={[{ path: "shared.ts", content: "local repo-a updated" }]}
        onPushSelected={jest.fn()}
      />,
    );

    await flushMicrotasks();

    expect(screen.queryByText("Diff kopieren")).toBeNull();
    expect(screen.queryByText("Unified Diff")).toBeNull();
    expect(screen.queryByText("+ remote repo-a")).toBeNull();
    expect(screen.queryByText("- local repo-a")).toBeNull();
  });

  it("shows an honest refresh hint after local files change inside the same repo/branch context", async () => {
    mockGetRepoFileText.mockResolvedValue("remote repo-a");

    const screen = renderSection();

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
    });

    screen.rerender(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-a"
        activeBranch="main"
        projectFiles={[{ path: "shared.ts", content: "local repo-a updated" }]}
        onPushSelected={jest.fn()}
      />,
    );

    await flushMicrotasks();

    expect(screen.getByText("Lokale Dateien wurden geändert. Vergleich neu laden.")).toBeTruthy();
    expect(screen.queryByText("✅ 0 • ✏️ 1 • ➕ 0 • ⬇️ 0 • ⏭️ 0 • ⚠️ 0")).toBeNull();
  });

  it("keeps the diff stable when the same repo/branch rerenders without local file changes", async () => {
    mockGetRepoFileText.mockResolvedValue("remote repo-a");

    const onPushSelected = jest.fn();
    const screen = render(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-a"
        activeBranch="main"
        projectFiles={[{ path: "shared.ts", content: "local repo-a" }]}
        onPushSelected={onPushSelected}
      />,
    );

    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));
    await waitFor(() => {
      expect(screen.getByText("shared.ts")).toBeTruthy();
      expect(screen.getByText("Push (1)")).toBeTruthy();
    });

    screen.rerender(
      <LocalRemoteDiffSection
        activeRepo="owner/repo-a"
        activeBranch="main"
        projectFiles={[{ path: "shared.ts", content: "local repo-a" }]}
        onPushSelected={onPushSelected}
      />,
    );

    await flushMicrotasks();

    expect(screen.getByText("shared.ts")).toBeTruthy();
    expect(screen.getByText("Push (1)")).toBeTruthy();
    expect(screen.queryByText("Lokale Dateien wurden geändert. Vergleich neu laden.")).toBeNull();
  });

  it("does not render remote-only as a lower-bound count when local files are sliced", async () => {
    mockGetRepoFileText.mockImplementation(({ path }: { path: string }) => Promise.resolve(`local ${path}`));
    mockListRepoBlobPaths.mockResolvedValue(["file-60.ts"]);

    const projectFiles = Array.from({ length: 61 }, (_, index) => ({
      path: `file-${index}.ts`,
      content: `local file-${index}.ts`,
    }));

    const screen = renderSection({ projectFiles });
    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));

    await waitFor(() => {
      expect(screen.getByText("file-60.ts")).toBeTruthy();
    });

    expect(
      screen.getByText(/kein Full-Sync-Schluss möglich/i),
    ).toBeTruthy();
    expect(screen.queryByText(/≥ ⬇️ 1/)).toBeNull();
    expect(screen.getByText(/⬇️ 1/)).toBeTruthy();
  });

  it("still renders remote-only as lower-bound when only remote-only list is truncated", async () => {
    mockGetRepoFileText.mockResolvedValue("same");
    mockListRepoBlobPaths.mockResolvedValue(
      Array.from({ length: 121 }, (_, index) => `remote-only-${index}.ts`),
    );

    const screen = renderSection({
      projectFiles: [{ path: "tracked.ts", content: "same" }],
    });
    fireEvent.press(screen.getByTestId("local-remote-diff-refresh"));

    await waitFor(() => {
      expect(screen.getByText(/Remote-only Liste wurde gekürzt/i)).toBeTruthy();
    });

    expect(screen.getByText(/≥ ⬇️ 120/)).toBeTruthy();
  });
});
