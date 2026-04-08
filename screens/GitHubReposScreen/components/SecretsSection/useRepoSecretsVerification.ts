import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listRepoSecretNames } from "../../../../infra/github/githubService";
import {
  resolveRepoSecretListVerification,
  resolveRepoSecretVerification,
} from "../../../../lib/status/repoSecretVerification";
import { getErrorMessage } from "../../hooks/githubReposScreenErrorHelpers";
import { splitFullName } from "../../utils/repos";
import { OPTIONAL_SECRETS, REQUIRED_SECRETS, SecretRow } from "./secretsSectionContracts";

export function useRepoSecretsVerification(activeRepo: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<string[] | null>(null);
  const [stale, setStale] = useState(false);
  const requestRef = useRef(0);
  const hasVerifiedNamesRef = useRef(false);

  const parsed = useMemo(() => (activeRepo ? splitFullName(activeRepo) : null), [activeRepo]);

  const load = useCallback(async () => {
    if (!parsed) {
      setNames(null);
      setStale(false);
      setError(null);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const hadVerifiedNames = hasVerifiedNamesRef.current;

    setLoading(true);
    setError(null);

    try {
      const list = await listRepoSecretNames(parsed.owner, parsed.repo);
      if (requestRef.current !== requestId) return;
      hasVerifiedNamesRef.current = true;
      setNames(list);
      setStale(false);
    } catch (e: unknown) {
      if (requestRef.current !== requestId) return;
      setError(getErrorMessage(e, "Secrets konnten nicht geladen werden."));
      setStale(hadVerifiedNames);
      if (!hadVerifiedNames) {
        setNames(null);
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [parsed]);

  useEffect(() => {
    requestRef.current += 1;
    hasVerifiedNamesRef.current = false;
    setNames(null);
    setError(null);
    setStale(false);
    setLoading(false);
  }, [activeRepo]);

  useEffect(() => {
    void load();
  }, [load]);

  const listContract = useMemo(
    () =>
      resolveRepoSecretListVerification({
        names,
        error,
        stale,
      }),
    [error, names, stale],
  );

  const requiredStatus = useMemo<SecretRow[]>(
    () =>
      REQUIRED_SECRETS.map((name) => ({
        name,
        contract: resolveRepoSecretVerification({
          name,
          names,
          error,
          stale,
        }),
      })),
    [error, names, stale],
  );

  const optionalStatus = useMemo<SecretRow[]>(
    () =>
      OPTIONAL_SECRETS.map((name) => ({
        name,
        contract: resolveRepoSecretVerification({
          name,
          names,
          error,
          stale,
        }),
      })),
    [error, names, stale],
  );

  return {
    parsed,
    loading,
    error,
    names,
    stale,
    load,
    listContract,
    requiredStatus,
    optionalStatus,
  };
}
