import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { debugLog } from "../../../lib/debugOverlay";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";
import {
  classifyVerificationError,
  type VerificationContractState,
} from "../../../lib/status/verificationContract";
import { safeAlertText } from "../utils/validation";
import {
  resolveEasProjectVerification,
  resolveEasTestPrecheck,
  resolveMissingConnectionRequirements,
  resolveExpoConnectionPersistence,
  resolveGitHubConnectionPersistence,
  resolveSupabaseConnectionPersistence,
} from "./useConnectionsScreenHelpers";
import {
  runEasProjectCheck,
  runExpoConnectionCheck,
  runGitHubConnectionCheck,
  runSupabaseConnectionCheck,
} from "./useConnectionsScreenProviderChecks";
import type { ConnectionRequirement } from "./connections.contracts";

type Params = {
  hydrated: boolean;
  githubToken: string;
  expoToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId: string;
  runGuardedAction: (params: {
    defaultTitle: string;
    task: () => Promise<void>;
    onNonBusyError?: (error: unknown) => Promise<void> | void;
  }) => Promise<void>;
  logConnectionFailure: (params: { channel: string; message: string; error: unknown }) => void;
  applyGitHubPersistence: (persistence: ReturnType<typeof resolveGitHubConnectionPersistence>) => Promise<void>;
  applyExpoPersistence: (persistence: ReturnType<typeof resolveExpoConnectionPersistence>) => Promise<void>;
  applySupabasePersistence: (persistence: ReturnType<typeof resolveSupabaseConnectionPersistence>) => Promise<void>;
  saveConnEasStatus: (params: {
    ok: boolean;
    state: VerificationContractState;
    verifiedAt?: string | null;
  }) => Promise<void>;
};

export function useConnectionsProviderTests(params: Params) {
  const {
    hydrated,
    githubToken,
    expoToken,
    supabaseUrl,
    supabaseAnonKey,
    easProjectId,
    runGuardedAction,
    logConnectionFailure,
    applyGitHubPersistence,
    applyExpoPersistence,
    applySupabasePersistence,
    saveConnEasStatus,
  } = params;
  const [isTestingEas, setIsTestingEas] = useState(false);

  const runProviderTest = useCallback(
    async (p: {
      defaultTitle: string;
      task: () => Promise<void>;
      onFailure: (error: unknown) => Promise<void>;
    }) => {
      await runGuardedAction({
        defaultTitle: p.defaultTitle,
        task: p.task,
        onNonBusyError: p.onFailure,
      });
    },
    [runGuardedAction],
  );

  const runConnectionCheck = useCallback(
    async <T,>(p: {
      defaultTitle: string;
      requirements?: ConnectionRequirement[];
      runCheck: () => Promise<T>;
      onSuccess: (result: T) => Promise<void>;
      onFailure: (error: unknown) => Promise<void>;
      failureLog?: { channel: string; message: string };
    }) => {
      if (!hydrated) return;
      const missingRequirement = resolveMissingConnectionRequirements(p.requirements ?? []);
      if (missingRequirement) {
        Alert.alert("Fehlt", missingRequirement);
        return;
      }

      await runProviderTest({
        defaultTitle: p.defaultTitle,
        task: async () => {
          const result = await p.runCheck();
          await p.onSuccess(result);
        },
        onFailure: async (error: unknown) => {
          await p.onFailure(error);
          if (p.failureLog) {
            logConnectionFailure({
              channel: p.failureLog.channel,
              message: p.failureLog.message,
              error,
            });
          }
        },
      });
    },
    [hydrated, logConnectionFailure, runProviderTest],
  );

  const testGitHub = useCallback(async () => {
    await runConnectionCheck({
      defaultTitle: "GitHub Test",
      requirements: [{ value: githubToken, message: "GitHub Token fehlt." }],
      runCheck: async () => {
        const token = githubToken.trim();
        debugLog("connections:github", "GET /user", {
          url: "https://api.github.com/user",
        });
        debugLog("connections:github", "Response", {
          tokenConfigured: true,
        });
        return runGitHubConnectionCheck(token);
      },
      onSuccess: async (result) => {
        const persistence = resolveGitHubConnectionPersistence({
          kind: "ok",
          login: result.login,
          scopes: result.scopes,
        });
        await applyGitHubPersistence(persistence);
        Alert.alert(
          "GitHub OK",
          `Verbunden als: ${persistence.login || "OK"}${persistence.scopes ? `\nScopes: ${persistence.scopes}` : ""}`,
        );
      },
      onFailure: async () => {
        await applyGitHubPersistence(resolveGitHubConnectionPersistence({ kind: "failed" }));
      },
      failureLog: { channel: "connections:github", message: "GitHub ERROR" },
    });
  }, [githubToken, applyGitHubPersistence, runConnectionCheck]);

  const testExpo = useCallback(async () => {
    await runConnectionCheck({
      defaultTitle: "Expo Test",
      requirements: [{ value: expoToken, message: "Expo / EAS Token fehlt." }],
      runCheck: async () => {
        const token = expoToken.trim();
        debugLog("connections:expo", "POST /graphql", { url: "https://api.expo.dev/graphql" });
        return runExpoConnectionCheck(token);
      },
      onSuccess: async (result) => {
        debugLog("connections:expo", "Response", {
          status: result.status,
          ok: result.ok,
          body: redactSecrets(truncateWithMarker(result.raw, 1000)),
        });
        const persistence = resolveExpoConnectionPersistence({
          kind: "ok",
          username: result.username,
        });
        await applyExpoPersistence(persistence);
        Alert.alert("Expo OK", persistence.username ? `Verbunden als: ${persistence.username}` : "Token ist gueltig.");
      },
      onFailure: async () => {
        await applyExpoPersistence(resolveExpoConnectionPersistence({ kind: "failed" }));
      },
      failureLog: { channel: "connections:expo", message: "Expo ERROR" },
    });
  }, [expoToken, applyExpoPersistence, runConnectionCheck]);

  const testSupabase = useCallback(async () => {
    await runConnectionCheck({
      defaultTitle: "Supabase Test",
      requirements: [
        { value: supabaseUrl, message: "Supabase URL fehlt." },
        { value: supabaseAnonKey, message: "Supabase ANON Key fehlt." },
      ],
      runCheck: async () => runSupabaseConnectionCheck(supabaseUrl.trim(), supabaseAnonKey.trim()),
      onSuccess: async (result) => {
        if (result.kind === "rls_protected") {
          await applySupabasePersistence(resolveSupabaseConnectionPersistence({ kind: "rls_protected" }));
          Alert.alert(
            "Supabase OK",
            "REST erreichbar. build_jobs ist durch RLS geschützt (401/403) – das ist okay. CI/Edge nutzt den Service-Role-Key serverseitig.",
          );
          return;
        }
        await applySupabasePersistence(
          resolveSupabaseConnectionPersistence({ kind: "ok", ref: result.ref }),
        );
        Alert.alert("Supabase OK", "REST + build_jobs erreichbar.");
      },
      onFailure: async () => {
        await applySupabasePersistence(resolveSupabaseConnectionPersistence({ kind: "failed" }));
      },
      failureLog: { channel: "connections:supabase", message: "Supabase ERROR" },
    });
  }, [supabaseUrl, supabaseAnonKey, applySupabasePersistence, runConnectionCheck]);

  const testEas = useCallback(async () => {
    if (!hydrated) return;
    await runGuardedAction({
      defaultTitle: "EAS Test",
      task: async () => {
        const precheck = resolveEasTestPrecheck({
          easProjectId,
          expoToken,
        });
        if (precheck.shouldStop) {
          if (precheck.status) {
            await saveConnEasStatus(precheck.status);
          }
          if (precheck.alertMessage) {
            Alert.alert("EAS Test", precheck.alertMessage);
          }
          return;
        }

        setIsTestingEas(true);
        try {
          const easCheck = await runEasProjectCheck(easProjectId, expoToken);
          if (!easCheck.ok) {
            await saveConnEasStatus({
              ok: false,
              state: classifyVerificationError({ statusCode: easCheck.status }),
            });
            Alert.alert("EAS Test", `EAS Test failed (${easCheck.status})`);
            return;
          }

          const verification = resolveEasProjectVerification(easCheck.json, new Date().toISOString());
          await saveConnEasStatus({
            ok: verification.ok,
            state: verification.state,
            verifiedAt: verification.verifiedAt,
          });
          if (!verification.hasProject) {
            Alert.alert("EAS Test", "Projekt nicht gefunden oder keine Rechte");
          }
        } catch (e: unknown) {
          await saveConnEasStatus({
            ok: false,
            state: classifyVerificationError({ error: e }),
          });
          Alert.alert("EAS Test", `EAS Test failed (${safeAlertText(e)})`);
        } finally {
          setIsTestingEas(false);
        }
      },
    });
  }, [hydrated, runGuardedAction, easProjectId, expoToken, saveConnEasStatus]);

  return {
    testGitHub,
    testExpo,
    testSupabase,
    testEas,
    isTestingEas,
  };
}
