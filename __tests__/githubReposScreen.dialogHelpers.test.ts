import {
  getDeleteBranchConfirmDialog,
  getDeleteRepoConfirmDialog,
} from "../screens/GitHubReposScreen/hooks/githubReposScreenDialogHelpers";

describe("githubReposScreenDialogHelpers", () => {
  it("builds delete repo confirm text with repo name", () => {
    expect(getDeleteRepoConfirmDialog(" owner/repo ")).toEqual({
      title: "🗑️ Repo löschen?",
      message: "Willst du owner/repo wirklich löschen? Das kann nicht rückgängig gemacht werden.",
      confirmText: "Löschen",
    });
  });

  it("builds delete branch confirm text with branch name", () => {
    expect(getDeleteBranchConfirmDialog(" main ")).toEqual({
      title: "Branch löschen?",
      message: "main wirklich löschen?",
      confirmText: "Löschen",
    });
  });
});
