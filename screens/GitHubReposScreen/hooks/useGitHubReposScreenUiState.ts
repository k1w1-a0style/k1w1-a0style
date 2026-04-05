import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import type { RepoFilterType } from "./templateFiles";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";
import { getSecretsSyncNotice } from "./githubReposScreenNoticeHelpers";

type Deps = {
  activeRepo: string | null;
};

export function useGitHubReposScreenUiState(deps: Deps) {
  const { activeRepo } = deps;

  const [showRepoList, setShowRepoList] = useState(true);
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [showRenameRepo, setShowRenameRepo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<RepoFilterType>("all");

  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [renameName, setRenameName] = useState("");

  const [isSyncingSecrets, setIsSyncingSecrets] = useState(false);

  const handleSyncSecrets = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    setIsSyncingSecrets(true);
    try {
      const result = await autoSyncRepoSecrets(activeRepo);
      const syncNotice = getSecretsSyncNotice(result.updated);
      Alert.alert(syncNotice.title, syncNotice.message);
    } catch (e: unknown) {
      Alert.alert("❌ Secrets Sync fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsSyncingSecrets(false);
    }
  }, [activeRepo]);

  return {
    showRepoList,
    setShowRepoList,
    showNewRepo,
    setShowNewRepo,
    showRenameRepo,
    setShowRenameRepo,
    showAdvanced,
    setShowAdvanced,

    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,

    newRepoName,
    setNewRepoName,
    newRepoPrivate,
    setNewRepoPrivate,
    renameName,
    setRenameName,

    isSyncingSecrets,
    handleSyncSecrets,
  };
}
