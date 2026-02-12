import { splitFullName } from "../screens/GitHubReposScreen/utils/repos";

describe("GitHubReposScreen repo parsing", () => {
  test("splitFullName accepts simple owner/repo", () => {
    expect(splitFullName("octocat/Hello-World")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });

  test("splitFullName rejects multiple slashes", () => {
    expect(splitFullName("a/b/c")).toBeNull();
    expect(splitFullName("/a/b")).toBeNull();
    expect(splitFullName("a/b/")).toBeNull();
  });

  test("splitFullName rejects whitespace in segments", () => {
    expect(splitFullName("a /b")).toBeNull();
    expect(splitFullName("a/ b")).toBeNull();
    expect(splitFullName("a b/c")).toBeNull();
    expect(splitFullName("a/c d")).toBeNull();
  });

  test("splitFullName rejects invalid owner", () => {
    expect(splitFullName("-bad/repo")).toBeNull();
    expect(splitFullName("bad-/repo")).toBeNull();
    expect(splitFullName("bad_owner/repo")).toBeNull(); // underscore not allowed for owner
    expect(splitFullName("a".repeat(40) + "/repo")).toBeNull();
  });

  test("splitFullName rejects invalid repo name", () => {
    expect(splitFullName("owner/..")).toBeNull();
    expect(splitFullName("owner/-bad")).toBeNull();
    expect(splitFullName("owner/bad-")).toBeNull();
    expect(splitFullName("owner/bad..name")).toBeNull();
  });
});
