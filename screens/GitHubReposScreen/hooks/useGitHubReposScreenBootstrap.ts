import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { getGitHubToken } from "../../../infra/github/githubService";
import { getGitHubUser } from "../../../infra/github/user";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";

export function useGitHubReposScreenBootstrap() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [userLogin, setUserLogin] = useState<string>("");
  const [userLoading, setUserLoading] = useState(false);

  const [easProjectId, setEasProjectId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setTokenLoading(true);
      setTokenError(null);
      try {
        const t = await getGitHubToken();
        if (!mounted) return;
        setToken(t);
        if (!t) {
          setTokenError("Kein Token gefunden. Hinterlege eins im Verbindungen-Screen.");
        }
      } catch (e: unknown) {
        if (!mounted) return;
        setToken(null);
        setTokenError(getErrorMessage(e, "Token konnte nicht geladen werden."));
      } finally {
        if (mounted) setTokenLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!token) {
      setUserLogin("");
      return () => {
        mounted = false;
      };
    }
    setUserLoading(true);
    getGitHubUser()
      .then((u) => {
        if (!mounted) return;
        setUserLogin(String(u?.login || "").trim());
      })
      .catch(() => {
        if (!mounted) return;
        setUserLogin("");
      })
      .finally(() => {
        if (mounted) setUserLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => "");
      if (!mounted) return;
      setEasProjectId((id || "").trim());
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return {
    token,
    tokenLoading,
    tokenError,
    userLogin,
    userLoading,
    easProjectId,
    setEasProjectId,
  };
}
