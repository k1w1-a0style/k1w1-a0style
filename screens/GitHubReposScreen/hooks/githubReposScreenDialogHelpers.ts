export type ConfirmDialogText = {
  title: string;
  message: string;
  confirmText: string;
};

export function getDeleteRepoConfirmDialog(fullName: string): ConfirmDialogText {
  const repoName = String(fullName || "").trim();
  return {
    title: "🗑️ Repo löschen?",
    message: `Willst du ${repoName} wirklich löschen? Das kann nicht rückgängig gemacht werden.`,
    confirmText: "Löschen",
  };
}

export function getDeleteBranchConfirmDialog(branchName: string): ConfirmDialogText {
  const branch = String(branchName || "").trim();
  return {
    title: "Branch löschen?",
    message: `${branch} wirklich löschen?`,
    confirmText: "Löschen",
  };
}
