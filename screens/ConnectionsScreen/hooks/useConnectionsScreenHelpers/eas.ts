import type { VerificationContractState } from "../../../../lib/status/verificationContract";
import { STORAGE_KEYS } from "../../../../lib/storageKeys";
import type { PersistableEntry } from "./types";
import { buildRepoOkLine } from "./status";
import { resolveConnectionsAlertNotice } from "./notices";

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

export const resolveEasLinkWorkflowStartMessage = (projectId: string): string => {
  return projectId
    ? "EAS Link-Workflow gestartet. Check GitHub Actions (eas-link)."
    : "Keine EAS ID vorhanden. Init+Link Workflow gestartet (erstellt eine neue Project ID).\n\nNach Abschluss: Sync drücken, damit die App die neue ID aus dem Repo übernimmt.";
};

export const resolveEasLinkPostStartState = (projectId: string): {
  state: VerificationContractState;
  writes: PersistableEntry[];
  removes: string[];
} => {
  const state: VerificationContractState = projectId ? "stale" : "missing";
  return {
    state,
    writes: [
      [STORAGE_KEYS.CONN_EAS_OK, "false"],
      [STORAGE_KEYS.CONN_EAS_STATE, state],
    ],
    removes: [STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT],
  };
};

export const resolveRepoSelectionPersistence = (params: {
  repoSlug: string;
  branch: string;
}): {
  repoOkLine: string;
  writes: PersistableEntry[];
} => {
  const repoSlug = params.repoSlug.trim();
  const branch = params.branch.trim();
  return {
    repoOkLine: buildRepoOkLine(repoSlug, branch),
    writes: [
      [STORAGE_KEYS.CONN_REPO_OK, "true"],
      [STORAGE_KEYS.CONN_REPO_SLUG, repoSlug],
      [STORAGE_KEYS.CONN_REPO_BRANCH, branch],
    ],
  };
};

export const resolveEasStatusPersistence = (params: {
  ok: boolean;
  state: VerificationContractState;
  verifiedAt?: string | null;
}): {
  writes: PersistableEntry[];
  removes: string[];
} => {
  const verifiedAt = params.verifiedAt ?? null;
  const writes: PersistableEntry[] = [
    [STORAGE_KEYS.CONN_EAS_OK, params.ok ? "true" : "false"],
    [STORAGE_KEYS.CONN_EAS_STATE, params.state],
  ];
  const removes: string[] = [];
  if (verifiedAt) {
    writes.push([STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT, verifiedAt]);
  } else {
    removes.push(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT);
  }
  return { writes, removes };
};

export const resolveEasProjectIdPersistenceAction = (
  projectId: string,
): { mode: "set"; value: string } | { mode: "remove" } => {
  const trimmed = projectId.trim();
  if (trimmed) {
    return { mode: "set", value: trimmed };
  }
  return { mode: "remove" };
};

export const resolveEasLinkWorkflowTriggerInputs = (params: {
  branch: string;
  projectId: string;
}): { ref: string; eas_project_id?: string } => {
  const ref = params.branch.trim();
  const projectId = params.projectId.trim();
  if (!projectId) {
    return { ref };
  }
  return {
    ref,
    eas_project_id: projectId,
  };
};

export type EasLaunchPlan =
  | {
      kind: "start";
      projectId: string;
      persistProjectIdSelection: boolean;
      notice: { title: string; message: string };
    }
  | {
      kind: "confirm_create";
      title: string;
      message: string;
    };

export const resolveEasLaunchPlan = (params: {
  mode: "link_existing" | "create_and_link";
  easProjectId: string;
}): EasLaunchPlan => {
  if (params.mode === "create_and_link") {
    return {
      kind: "start",
      projectId: "",
      persistProjectIdSelection: false,
      notice: resolveConnectionsAlertNotice("create_link_workflow_started"),
    };
  }

  const projectId = params.easProjectId.trim();
  if (!projectId) {
    return {
      kind: "confirm_create",
      title: "Keine EAS ID vorhanden!",
      message: "Soll eine erstellt werden?",
    };
  }

  return {
    kind: "start",
    projectId,
    persistProjectIdSelection: true,
    notice: {
      title: "OK",
      message: resolveEasLinkWorkflowStartMessage(projectId),
    },
  };
};
