import { useCallback, useState } from "react";
import { Alert } from "react-native";

import type { GitHubRepo } from "../../../hooks/useGitHubRepos";
import {
  createRepo,
  deleteRepo as deleteGitHubRepo,
  renameRepo as renameGitHubRepo,
  createBranch,
  deleteBranch,
  renameBranch,
} from "../../../infra/github/githubService";
import { splitFullName, isValidRepoName } from "../utils/repos";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";
import { getDeleteBranchConfirmDialog, getDeleteRepoConfirmDialog } from "./githubReposScreenDialogHelpers";
import { getRepoSuccessNotice } from "./githubReposScreenNoticeHelpers";

type LegacyCreateRepoResponse = {
  owner?: { login?: string };
  name?: string;
  full_name?: string;
};

const isGitHubRepo = (value: unknown): value is GitHubRepo => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const repo = value as Record<string, unknown>;
  return (
    typeof repo.id === "number" &&
    typeof repo.name === "string" &&
    typeof repo.full_name === "string" &&
    typeof repo.private === "boolean" &&
    typeof repo.updated_at === "string"
  );
};

const readCreatedRepoFullName = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as LegacyCreateRepoResponse;
  const direct = typeof record.full_name === "string" ? record.full_name.trim() : "";
  if (direct) return direct;

  const ownerLogin = typeof record.owner?.login === "string" ? record.owner.login.trim() : "";
  const repoName = typeof record.name === "string" ? record.name.trim() : "";
  return ownerLogin && repoName ? `${ownerLogin}/${repoName}` : null;
};

type ManageModalConfig = {
  title: string;
  placeholder: string;
  initialValue?: string;
  confirmText?: string;
  action: (value: string) => Promise<void>;
};

type Deps = {
  token: string | null;
  activeRepo: string | null;
  activeBranch: string | null;
  renameName: string;
  newRepoName: string;
  newRepoPrivate: boolean;
  addRecentRepo: (repo: string) => void;
  setLinkedRepo: (repo: string | null, branch: string | null) => void;
  loadRepos: () => Promise<void>;
  loadDefaultBranch: (owner: string, repo: string) => Promise<string>;
  setShowRenameRepo: (next: boolean) => void;
  setShowNewRepo: (next: boolean) => void;
  setRenameName: (name: string) => void;
  setNewRepoName: (name: string) => void;
};

export function useGitHubRepoCrud(deps: Deps) {
  const {
    token,
    activeRepo,
    activeBranch,
    renameName,
    newRepoName,
    newRepoPrivate,
    addRecentRepo,
    setLinkedRepo,
    loadRepos,
    loadDefaultBranch,
    setShowRenameRepo,
    setShowNewRepo,
    setRenameName,
    setNewRepoName,
  } = deps;

  const [localRepos, setLocalRepos] = useState<GitHubRepo[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeletingRepo, setIsDeletingRepo] = useState(false);

  const [manageModal, setManageModal] = useState<ManageModalConfig | null>(null);
  const [manageValue, setManageValue] = useState("");
  const [manageBusy, setManageBusy] = useState(false);

  const openManageModal = useCallback((cfg: ManageModalConfig) => {
    setManageModal(cfg);
    setManageValue(cfg.initialValue ?? "");
  }, []);

  const closeManageModal = useCallback(() => setManageModal(null), []);

  const confirmManageModal = useCallback(async () => {
    if (!manageModal || manageBusy) return;
    setManageBusy(true);
    try {
      await manageModal.action(manageValue);
    } finally {
      setManageBusy(false);
    }
  }, [manageModal, manageBusy, manageValue]);

  const handleCreateRepo = useCallback(async () => {
    if (!token) return;
    const name = newRepoName.trim();
    const validation = isValidRepoName(name);
    if (!validation.valid) {
      Alert.alert("❌ Ungültiger Name", validation.error ?? "");
      return;
    }

    setIsCreating(true);
    try {
      const repoResponse = await createRepo(name, newRepoPrivate);
      if (isGitHubRepo(repoResponse)) {
        const repo = repoResponse;
        setLocalRepos((prev) => [repo, ...prev]);
        setNewRepoName("");
        setShowNewRepo(false);
        addRecentRepo(repo.full_name);
        const defaultBranch = String(repo.default_branch || "").trim() || null;
        setLinkedRepo(repo.full_name, defaultBranch);
        const successNotice = getRepoSuccessNotice("repo_created", repo.full_name);
        Alert.alert(successNotice.title, successNotice.message);
      } else {
        const repoFullName = readCreatedRepoFullName(repoResponse);
        if (!repoFullName) {
          throw new Error("GitHub API Antwort für neues Repository ist unvollständig.");
        }
        await loadRepos();
        setNewRepoName("");
        setShowNewRepo(false);
        addRecentRepo(repoFullName);
        setLinkedRepo(repoFullName, null);
        const successNotice = getRepoSuccessNotice("repo_created", repoFullName);
        Alert.alert(successNotice.title, successNotice.message);
      }
    } catch (e: unknown) {
      Alert.alert("❌ Repo erstellen fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsCreating(false);
    }
  }, [token, newRepoName, newRepoPrivate, setNewRepoName, setShowNewRepo, addRecentRepo, setLinkedRepo, loadRepos]);

  const handleRenameRepo = useCallback(async () => {
    if (!token || !activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const newName = renameName.trim();
    const validation = isValidRepoName(newName);
    if (!validation.valid) {
      Alert.alert("❌ Ungültiger Name", validation.error ?? "");
      return;
    }

    setIsRenaming(true);
    try {
      const res = await renameGitHubRepo(parsed.owner, parsed.repo, newName);
      const newFullName = res.full_name ?? `${parsed.owner}/${newName}`;
      setLinkedRepo(newFullName, activeBranch ?? null);
      addRecentRepo(newFullName);
      setShowRenameRepo(false);
      setRenameName("");
      const successNotice = getRepoSuccessNotice("repo_renamed", newFullName);
      Alert.alert(successNotice.title, successNotice.message);
      await loadRepos();
    } catch (e: unknown) {
      Alert.alert("❌ Umbenennen fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsRenaming(false);
    }
  }, [token, activeRepo, renameName, setLinkedRepo, activeBranch, addRecentRepo, setShowRenameRepo, setRenameName, loadRepos]);

  const handleDeleteRepo = useCallback(async (repo: GitHubRepo) => {
    if (!token) return;
    const full = repo.full_name;
    const parsed = splitFullName(full);
    if (!parsed) return;

    const dialogText = getDeleteRepoConfirmDialog(full);
    Alert.alert(dialogText.title, dialogText.message, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: dialogText.confirmText,
        style: "destructive",
        onPress: async () => {
          setIsDeletingRepo(true);
          try {
            await deleteGitHubRepo(parsed.owner, parsed.repo);
            setLocalRepos((prev) => prev.filter((r) => r.full_name !== full));
            if (activeRepo === full) {
              setLinkedRepo(null, null);
            }
            await loadRepos();
            const successNotice = getRepoSuccessNotice("repo_deleted", full);
            Alert.alert(successNotice.title, successNotice.message);
          } catch (e: unknown) {
            Alert.alert("❌ Löschen fehlgeschlagen", getErrorMessage(e, ""));
          } finally {
            setIsDeletingRepo(false);
          }
        },
      },
    ]);
  }, [token, activeRepo, setLinkedRepo, loadRepos]);

  const handleCreateBranch = useCallback(() => {
    if (!activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    openManageModal({
      title: "Neuen Branch erstellen",
      placeholder: "branch-name",
      confirmText: "Erstellen",
      action: async (value: string) => {
        const name = value.trim();
        if (!name) throw new Error("Branch Name fehlt.");
        const base = activeBranch ?? (await loadDefaultBranch(parsed.owner, parsed.repo));
        await createBranch(parsed.owner, parsed.repo, name, base);
        setLinkedRepo(activeRepo, name);
        closeManageModal();
      },
    });
  }, [activeRepo, activeBranch, loadDefaultBranch, openManageModal, closeManageModal, setLinkedRepo]);

  const handleRenameBranch = useCallback(() => {
    if (!activeRepo || !activeBranch) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    openManageModal({
      title: "Branch umbenennen",
      placeholder: "neuer-branch-name",
      initialValue: activeBranch,
      confirmText: "Umbenennen",
      action: async (newName: string) => {
        const name = newName.trim();
        if (!name) throw new Error("Branch Name fehlt.");
        const res = await renameBranch(parsed.owner, parsed.repo, activeBranch, name);
        setLinkedRepo(activeRepo, res.name);
        closeManageModal();
      },
    });
  }, [activeRepo, activeBranch, openManageModal, closeManageModal, setLinkedRepo]);

  const handleDeleteBranch = useCallback(() => {
    if (!activeRepo || !activeBranch) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    const dialogText = getDeleteBranchConfirmDialog(activeBranch);
    Alert.alert(dialogText.title, dialogText.message, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: dialogText.confirmText,
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBranch(parsed.owner, parsed.repo, activeBranch);
            setLinkedRepo(activeRepo, null);
            const successNotice = getRepoSuccessNotice("branch_deleted", activeBranch);
            Alert.alert(successNotice.title, successNotice.message);
          } catch (e: unknown) {
            Alert.alert("❌ Fehler", getErrorMessage(e, ""));
          }
        },
      },
    ]);
  }, [activeRepo, activeBranch, setLinkedRepo]);

  return {
    localRepos,
    isCreating,
    isRenaming,
    isDeletingRepo,
    handleCreateRepo,
    handleRenameRepo,
    handleDeleteRepo,
    handleCreateBranch,
    handleRenameBranch,
    handleDeleteBranch,
    manageModal,
    manageValue,
    manageBusy,
    setManageValue,
    closeManageModal,
    confirmManageModal,
  };
}
