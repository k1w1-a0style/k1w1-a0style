import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getGitHubToken } from "../../../infra/github/githubService";
import { getGitHubUser } from "../../../infra/github/user";
import { logger } from "../../../lib/logger";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";
import { readScopedEasProjectId } from "../../../lib/easProjectIdScope";

export function useGitHubReposScreenBootstrap(selectedRepo?: string | null) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [userLogin, setUserLogin] = useState<string>("");
  const [userLoading, setUserLoading] = useState(false);

  const [easProjectId, setEasProjectId] = useState<string>("");
  const bootstrapReqIdRef = useRef(0);

  const refreshBootstrapState = useCallback(async () => {
    const reqId = ++bootstrapReqIdRef.current;
    setTokenLoading(true);
    setTokenError(null);
    setUserLoading(true);
    try {
      const t = await getGitHubToken();
      if (bootstrapReqIdRef.current !== reqId) return;

      setToken(t);
      if (!t) {
        setTokenError("Kein Token gefunden. Hinterlege eins im Verbindungen-Screen.");
        setUserLogin("");
      } else {
        try {
          const u = await getGitHubUser();
          if (bootstrapReqIdRef.current !== reqId) return;
          setUserLogin(String(u?.login || "").trim());
        } catch {
          if (bootstrapReqIdRef.current !== reqId) return;
          setUserLogin("");
        }
      }

      try {
        const id = await readScopedEasProjectId(selectedRepo);
        if (bootstrapReqIdRef.current !== reqId) return;
        setEasProjectId((id || "").trim());
      } catch (error: unknown) {
        logger.warn("[GitHubReposScreen] EAS project ID konnte nicht aus AsyncStorage geladen werden", {
          error,
        });
        if (bootstrapReqIdRef.current !== reqId) return;
        setEasProjectId("");
      }
    } catch (e: unknown) {
      if (bootstrapReqIdRef.current !== reqId) return;
      setToken(null);
      setUserLogin("");
      setTokenError(getErrorMessage(e, "Token konnte nicht geladen werden."));
    } finally {
      if (bootstrapReqIdRef.current === reqId) {
        setTokenLoading(false);
        setUserLoading(false);
      }
    }
  }, [selectedRepo]);

  useEffect(() => {
    void refreshBootstrapState();
  }, [refreshBootstrapState]);

  useFocusEffect(
    useCallback(() => {
      void refreshBootstrapState();
    }, [refreshBootstrapState]),
  );

  return {
    token,
    tokenLoading,
    tokenError,
    userLogin,
    userLoading,
    easProjectId,
    setEasProjectId,
    refreshBootstrapState,
  };
}
