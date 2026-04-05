import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import type { MutableRefObject } from "react";
import { createOrUpdateFile, getRepoFileText } from "../../../infra/github/githubService";
import { splitFullName } from "../utils/repos";
import { validateEasProjectId } from "../../ConnectionsScreen/utils/validation";
import {
  checkRepoEasLinkStatus,
  getEasLinkPresentation,
  resolveEasLinkWriteOutcome,
  type EasLinkPresentation,
} from "../utils/easLinkContract";
import {
  createEasLinkStatusRequestGuard,
  type EasLinkStatusRequestToken,
} from "../utils/easLinkStatusRequestGuard";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";
import { getEasLinkWriteNotice } from "./githubReposScreenNoticeHelpers";
import { buildRepoBranchContextKey, getEasLinkNeutralMessage } from "./useGitHubReposScreenHelpers";


type Deps = {
  activeRepo: string | null;
  activeBranch: string | null;
  easProjectId: string;
  isMountedRef: MutableRefObject<boolean>;
};

export function useGitHubReposEasLink(deps: Deps) {
  const { activeRepo, activeBranch, easProjectId, isMountedRef } = deps;

  const [isEasLinking, setIsEasLinking] = useState(false);
  const [easLinkStatus, setEasLinkStatus] = useState<EasLinkPresentation>(getEasLinkPresentation("unknown"));

  const easLinkContextKey = useMemo(
    () => buildRepoBranchContextKey(activeRepo, activeBranch),
    [activeRepo, activeBranch],
  );
  const easLinkStatusGuardRef = useRef(createEasLinkStatusRequestGuard(easLinkContextKey));

  useEffect(() => {
    easLinkStatusGuardRef.current.setContextKey(easLinkContextKey);
    setEasLinkStatus(
      getEasLinkPresentation(
        "unknown",
        getEasLinkNeutralMessage(easLinkContextKey),
      ),
    );
  }, [easLinkContextKey]);

  const isCurrentEasLinkRequest = useCallback((requestId: number, contextKey: string | null) => {
    if (!isMountedRef.current) return false;
    return easLinkStatusGuardRef.current.isCurrent({ requestId, contextKey });
  }, [isMountedRef]);

  const handleEasLinkStatusCheck = useCallback(async (): Promise<EasLinkPresentation | null> => {
    if (!activeRepo || !activeBranch) {
      easLinkStatusGuardRef.current.invalidate();
      const presentation = getEasLinkPresentation("unknown", "Repo oder Branch sind noch nicht ausgewaehlt.");
      setEasLinkStatus(presentation);
      return presentation;
    }

    const parsed = splitFullName(activeRepo);
    if (!parsed) {
      easLinkStatusGuardRef.current.invalidate();
      const presentation = getEasLinkPresentation("unknown", "Repo-Auswahl konnte nicht verarbeitet werden.");
      setEasLinkStatus(presentation);
      return presentation;
    }

    const contextKey = `${activeRepo}@@${activeBranch}`;
    const requestToken = easLinkStatusGuardRef.current.begin(contextKey);
    const presentation = await checkRepoEasLinkStatus({
      expectedProjectId: easProjectId,
      loadFile: (path: string) =>
        getRepoFileText({
          owner: parsed.owner,
          repo: parsed.repo,
          path,
          ref: activeBranch,
        }),
    });

    if (!isCurrentEasLinkRequest(requestToken.requestId, requestToken.contextKey)) {
      return null;
    }

    setEasLinkStatus(presentation);
    return presentation;
  }, [activeRepo, activeBranch, easProjectId, isCurrentEasLinkRequest]);

  const handleEasLink = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const id = (easProjectId || "").trim();
    if (!id) {
      Alert.alert("⚠️", "Bitte EAS Project ID setzen (AsyncStorage).");
      return;
    }

    const idValidation = validateEasProjectId(id);
    if (!idValidation.ok) {
      Alert.alert(idValidation.title, idValidation.message);
      return;
    }

    const branch = (activeBranch || "").trim();
    if (!branch) {
      Alert.alert("⚠️", "Kein Branch ausgewählt.");
      return;
    }

    const contextKey = buildRepoBranchContextKey(activeRepo, branch);
    if (!contextKey) {
      setEasLinkStatus(getEasLinkPresentation("unknown", "Repo oder Branch sind noch nicht ausgewaehlt."));
      return;
    }
    const writeToken = easLinkStatusGuardRef.current.begin(contextKey);

    setIsEasLinking(true);
    if (isCurrentEasLinkRequest(writeToken.requestId, writeToken.contextKey)) {
      setEasLinkStatus(
        getEasLinkPresentation(
          "pending_recheck",
          "Schreibe `eas-project.json` und pruefe den Repo-Zustand danach erneut.",
        ),
      );
    }
    try {
      const easProjectJsonPath = "eas-project.json";
      const content = JSON.stringify({ projectId: id }, null, 2) + "\n";

      await createOrUpdateFile(
        parsed.owner,
        parsed.repo,
        easProjectJsonPath,
        content,
        "chore(eas): write eas-project.json",
        branch,
      );

      if (!isCurrentEasLinkRequest(writeToken.requestId, writeToken.contextKey)) {
        return;
      }

      const verification = await handleEasLinkStatusCheck();
      if (!verification) {
        return;
      }

      const recheckToken: EasLinkStatusRequestToken = {
        requestId: easLinkStatusGuardRef.current.getCurrentRequestId(),
        contextKey,
      };
      const writeOutcome = resolveEasLinkWriteOutcome({ verification });
      if (isCurrentEasLinkRequest(recheckToken.requestId, recheckToken.contextKey)) {
        setEasLinkStatus(writeOutcome);
      }

      if (!isCurrentEasLinkRequest(recheckToken.requestId, recheckToken.contextKey)) {
        return;
      }

      const writeNotice = getEasLinkWriteNotice(writeOutcome);
      Alert.alert(writeNotice.title, writeNotice.message);
    } catch (e: unknown) {
      if (isCurrentEasLinkRequest(writeToken.requestId, writeToken.contextKey)) {
        setEasLinkStatus(getEasLinkPresentation("unknown", "Schreiben oder Nachverifikation ist fehlgeschlagen."));
        Alert.alert("❌ EAS link fehlgeschlagen", getErrorMessage(e, ""));
      }
    } finally {
      setIsEasLinking(false);
    }
  }, [activeRepo, activeBranch, easProjectId, handleEasLinkStatusCheck, isCurrentEasLinkRequest]);

  return {
    isEasLinking,
    easLinkStatus,
    handleEasLinkStatusCheck,
    handleEasLink,
  };
}
