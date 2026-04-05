import { buildGitHubReposScreenReturnModel } from "../screens/GitHubReposScreen/hooks/useGitHubReposScreenReturnModel";

describe("useGitHubReposScreenReturnModel", () => {
  it("merges all return sections into one flat model", () => {
    const model = buildGitHubReposScreenReturnModel({
      localProject: { a: 1 },
      token: { b: 2 },
      repos: { c: 3 },
      selection: { d: 4 },
      uiStates: { e: 5 },
      filtersAndForms: { f: 6 },
      ops: { g: 7 },
      pushUi: { h: 8 },
      pullUi: { i: 9 },
      sync: { j: 10 },
      eas: { k: 11 },
      githubApiHelpers: { l: 12 },
      branchOps: { m: 13 },
      manageModal: { n: 14 },
    });

    expect(model).toEqual({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
      f: 6,
      g: 7,
      h: 8,
      i: 9,
      j: 10,
      k: 11,
      l: 12,
      m: 13,
      n: 14,
    });
  });
});
