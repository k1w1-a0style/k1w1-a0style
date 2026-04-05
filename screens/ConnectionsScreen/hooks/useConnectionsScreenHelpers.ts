import type { VerificationContractState } from "../../../lib/status/verificationContract";
import { logger } from "../../../lib/logger";
import { runCleanupTask } from "../../../lib/safeCleanup";

export type ExpoProjectResponse = {
  data?: {
    id?: string;
    slug?: string;
    name?: string;
    project?: {
      id?: string;
      slug?: string;
    };
  };
};

const EAS_STATES: VerificationContractState[] = [
  "verified",
  "missing",
  "unknown",
  "auth_error",
  "stale",
];

export const isPersistedEasState = (value: string | null): value is VerificationContractState => {
  if (!value) return false;
  return EAS_STATES.includes(value as VerificationContractState);
};

export const resolvePersistedEasState = (params: {
  state: string | null;
  easProjectId: string;
  lastVerifiedAt: string | null;
}): VerificationContractState | null => {
  const { state, easProjectId, lastVerifiedAt } = params;
  if (isPersistedEasState(state)) {
    return state;
  }

  if (easProjectId.trim() || lastVerifiedAt) {
    return lastVerifiedAt ? "verified" : "stale";
  }

  return null;
};

export const buildRepoOkLine = (repoSlug: string | null, repoBranch: string | null): string => {
  const slug = String(repoSlug ?? "").trim();
  const branch = String(repoBranch ?? "").trim();
  if (slug && branch) return `${slug} (${branch})`;
  if (slug) return slug;
  return "";
};

export const hasExpoProject = (payload: ExpoProjectResponse | null): boolean => {
  return Boolean(
    payload?.data?.id ||
      payload?.data?.project?.id ||
      payload?.data?.project?.slug ||
      payload?.data?.slug ||
      payload?.data?.name,
  );
};

export const resolveEasProjectVerification = (
  payload: ExpoProjectResponse | null,
  nowIso: string,
): {
  ok: boolean;
  state: VerificationContractState;
  verifiedAt: string | null;
  hasProject: boolean;
} => {
  const hasProject = hasExpoProject(payload);
  return {
    ok: hasProject,
    state: hasProject ? "verified" : "unknown",
    verifiedAt: hasProject ? nowIso : null,
    hasProject,
  };
};

export const resolveEasTestPrecheck = (params: {
  easProjectId: string;
  expoToken: string;
}): {
  shouldStop: boolean;
  status: { ok: boolean; state: VerificationContractState } | null;
  alertMessage: string | null;
} => {
  const projectId = params.easProjectId.trim();
  if (!projectId) {
    return {
      shouldStop: true,
      status: { ok: false, state: "missing" },
      alertMessage: null,
    };
  }

  const expoToken = params.expoToken.trim();
  if (!expoToken) {
    return {
      shouldStop: true,
      status: { ok: false, state: "unknown" },
      alertMessage: "Expo Token fehlt (für EAS Test erforderlich)",
    };
  }

  return {
    shouldStop: false,
    status: null,
    alertMessage: null,
  };
};

export const resolveConnectionsStatusFlags = (params: {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  linkedRepo: string | null | undefined;
  activeRepo: string | null | undefined;
  easProjectId: string;
}): {
  gh: boolean;
  ex: boolean;
  edge: boolean;
  sbUrl: boolean;
  sbAnon: boolean;
  linked: boolean;
  eas: boolean;
} => {
  const gh = !!params.githubToken.trim();
  const ex = !!params.expoToken.trim();
  const edge =
    !!params.workflowAdminKey.trim() ||
    !!params.androidKeystoreExportAdminKey.trim();
  const sbUrl = !!params.supabaseUrl.trim();
  const sbAnon = !!params.supabaseAnonKey.trim();
  const linked = !!(params.linkedRepo || params.activeRepo);
  const eas = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    params.easProjectId.trim(),
  );
  return { gh, ex, edge, sbUrl, sbAnon, linked, eas };
};

export const resolveLinkExistingSelectionPrecheck = (params: {
  githubToken: string;
  repoSlug: string;
  branch: string;
}): { ok: boolean; alertTitle: string | null; alertMessage: string | null } => {
  if (!params.githubToken.trim()) {
    return {
      ok: false,
      alertTitle: "Fehler",
      alertMessage: "GitHub Token fehlt (oder ist leer).",
    };
  }
  if (!params.repoSlug.trim()) {
    return {
      ok: false,
      alertTitle: "Fehler",
      alertMessage: "Kein Repo ausgewählt.",
    };
  }
  if (!params.branch.trim()) {
    return {
      ok: false,
      alertTitle: "Fehler",
      alertMessage: "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen.",
    };
  }
  return { ok: true, alertTitle: null, alertMessage: null };
};

export const resolveEasLinkWorkflowStartMessage = (projectId: string): string => {
  return projectId
    ? "EAS Link-Workflow gestartet. Check GitHub Actions (eas-link)."
    : "Keine EAS ID vorhanden. Init+Link Workflow gestartet (erstellt eine neue Project ID).\n\nNach Abschluss: Sync drücken, damit die App die neue ID aus dem Repo übernimmt.";
};

export type ConnectionsAlertNoticeKey =
  | "missing_github_token"
  | "missing_repo_selection"
  | "missing_branch_selection"
  | "invalid_repo_format"
  | "create_link_workflow_started";

export const resolveConnectionsAlertNotice = (
  key: ConnectionsAlertNoticeKey,
): { title: string; message: string } => {
  switch (key) {
    case "missing_github_token":
      return { title: "Fehler", message: "GitHub Token fehlt (oder ist leer)." };
    case "missing_repo_selection":
      return { title: "Fehler", message: "Kein Repo ausgewählt." };
    case "missing_branch_selection":
      return {
        title: "Fehler",
        message: "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen.",
      };
    case "invalid_repo_format":
      return { title: "Fehler", message: "Repo-Format ist ungültig. Erwartet: owner/repo" };
    case "create_link_workflow_started":
      return {
        title: "OK",
        message: "EAS Create+Link Workflow gestartet. Check GitHub Actions (eas-link) und danach Repo commit/push abwarten.",
      };
    default:
      return { title: "Hinweis", message: "Unbekannter Verbindungsstatus." };
  }
};

export const deriveSupabaseRefFromUrl = (url: string): string => {
  const host = url.replace(/^https?:\/\//, "").split("/")[0] || "";
  return host.endsWith(".supabase.co") ? host.split(".")[0] || "" : "";
};

export type StorageLike = {
  multiSet: (entries: Array<[string, string]>) => Promise<unknown>;
  multiRemove: (keys: string[]) => Promise<unknown>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<unknown>;
};

export type PersistableEntry = [string, string];

export const persistEntriesWithFallback = async (
  storage: StorageLike,
  entries: PersistableEntry[],
): Promise<void> => {
  if (!entries.length) return;
  let multiSetFailed = false;
  try {
    await storage.multiSet(entries);
  } catch (error) {
    multiSetFailed = true;
    logger.warn("[ConnectionsScreen] storage multiSet failed, using item fallback", { err: error });
  }
  if (!multiSetFailed) return;
  await Promise.all(
    entries.map(([key, value]) =>
      runCleanupTask(
        () => storage.setItem(key, value),
        `[ConnectionsScreen] storage setItem failed for key=${key}`,
      ),
    ),
  );
};

export const removeEntriesWithFallback = async (
  storage: StorageLike,
  keys: string[],
): Promise<void> => {
  if (!keys.length) return;
  let multiRemoveFailed = false;
  try {
    await storage.multiRemove(keys);
  } catch (error) {
    multiRemoveFailed = true;
    logger.warn("[ConnectionsScreen] storage multiRemove failed, using item fallback", { err: error });
  }
  if (!multiRemoveFailed) return;
  await Promise.all(
    keys.map((key) =>
      runCleanupTask(
        () => storage.removeItem(key),
        `[ConnectionsScreen] storage removeItem failed for key=${key}`,
      ),
    ),
  );
};
