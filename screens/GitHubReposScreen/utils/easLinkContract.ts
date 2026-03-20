import { classifyVerificationError } from "../../../lib/status/verificationContract";

export type EasLinkStatus =
  | "verified"
  | "workflow_missing"
  | "project_missing"
  | "project_invalid"
  | "project_mismatch"
  | "auth_error"
  | "unknown"
  | "pending_recheck";

export type EasLinkPresentation = {
  state: EasLinkStatus;
  label: string;
  detail: string;
  tone: "ok" | "error" | "warn" | "neutral";
};

type RepoFileLoader = (path: string) => Promise<string>;

type ProjectFileState =
  | { kind: "verified" }
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "mismatch"; actualProjectId: string }
  | { kind: "auth_error" }
  | { kind: "unknown" };

const EAS_WORKFLOW_PATH = ".github/workflows/eas-link.yml";
const EAS_PROJECT_PATH = "eas-project.json";

function readErrorMessage(error: unknown): string {
  return String(
    typeof error === "string"
      ? error
      : (error as { message?: unknown } | null | undefined)?.message ?? "",
  ).toLowerCase();
}

function isNotFoundError(error: unknown): boolean {
  const message = readErrorMessage(error);
  return message.includes("404") || message.includes("not found");
}

function classifyRepoAccessError(error: unknown): "auth_error" | "unknown" {
  return classifyVerificationError({ error }) === "auth_error" ? "auth_error" : "unknown";
}

function classifyProjectFile(params: {
  content?: string;
  error?: unknown;
  expectedProjectId: string;
}): ProjectFileState {
  if (params.error) {
    if (isNotFoundError(params.error)) return { kind: "missing" };
    return { kind: classifyRepoAccessError(params.error) };
  }

  try {
    const parsed = JSON.parse(String(params.content || "{}")) as { projectId?: unknown };
    const projectId = String(parsed?.projectId || "").trim();
    if (!projectId) return { kind: "invalid" };
    if (projectId !== params.expectedProjectId) {
      return { kind: "mismatch", actualProjectId: projectId };
    }
    return { kind: "verified" };
  } catch {
    return { kind: "invalid" };
  }
}

function resolveWorkflowState(error?: unknown): Exclude<EasLinkStatus, "verified" | "project_missing" | "project_invalid" | "project_mismatch" | "pending_recheck"> | "ok" {
  if (!error) return "ok";
  if (isNotFoundError(error)) return "workflow_missing";
  return classifyRepoAccessError(error);
}

export async function checkRepoEasLinkStatus(params: {
  expectedProjectId: string;
  loadFile: RepoFileLoader;
}): Promise<EasLinkPresentation> {
  const expectedProjectId = String(params.expectedProjectId || "").trim();
  if (!expectedProjectId) {
    return getEasLinkPresentation("unknown", "Keine erwartete EAS Project ID gespeichert.");
  }

  let workflowError: unknown;
  let projectContent = "";
  let projectError: unknown;

  try {
    await params.loadFile(EAS_WORKFLOW_PATH);
  } catch (error) {
    workflowError = error;
  }

  try {
    projectContent = await params.loadFile(EAS_PROJECT_PATH);
  } catch (error) {
    projectError = error;
  }

  const workflowState = resolveWorkflowState(workflowError);
  const projectState = classifyProjectFile({
    content: projectContent,
    error: projectError,
    expectedProjectId,
  });

  if (workflowState === "auth_error" || projectState.kind === "auth_error") {
    return getEasLinkPresentation(
      "auth_error",
      "Repo-Inhalt konnte mit diesem GitHub-Zugriff nicht sicher geprueft werden.",
    );
  }

  if (workflowState === "workflow_missing") {
    const suffix =
      projectState.kind === "verified"
        ? " Projektdatei passt bereits, aber der Workflow fehlt."
        : projectState.kind === "mismatch"
          ? " Projektdatei ist vorhanden, aber die Project ID passt nicht."
          : projectState.kind === "invalid"
            ? " Projektdatei ist vorhanden, aber ungueltig."
            : projectState.kind === "missing"
              ? " Projektdatei fehlt ebenfalls."
              : " Projektdatei konnte nicht sicher verifiziert werden.";
    return getEasLinkPresentation("workflow_missing", `Workflow fehlt.${suffix}`);
  }

  if (workflowState === "unknown") {
    return getEasLinkPresentation("unknown", "Workflow oder Projektdatei konnten aktuell nicht sicher verifiziert werden.");
  }

  if (projectState.kind === "missing") {
    return getEasLinkPresentation("project_missing", "`eas-project.json` fehlt im ausgewaehlten Repo/Branch.");
  }

  if (projectState.kind === "invalid") {
    return getEasLinkPresentation("project_invalid", "`eas-project.json` ist vorhanden, aber ohne gueltige `projectId`.");
  }

  if (projectState.kind === "mismatch") {
    return getEasLinkPresentation(
      "project_mismatch",
      `Repo verweist auf eine andere EAS Project ID als erwartet.`,
    );
  }

  if (projectState.kind === "unknown") {
    return getEasLinkPresentation("unknown", "Projektdatei konnte aktuell nicht sicher gelesen werden.");
  }

  return getEasLinkPresentation("verified", "Workflow vorhanden und EAS Project ID stimmt mit der erwarteten ID ueberein.");
}

export function resolveEasLinkWriteOutcome(params: {
  verification: EasLinkPresentation;
}): EasLinkPresentation {
  if (params.verification.state === "verified") {
    return getEasLinkPresentation("verified", "Repo-Link vollstaendig verifiziert.");
  }

  if (params.verification.state === "unknown") {
    return getEasLinkPresentation(
      "pending_recheck",
      "Projektdatei wurde geschrieben, aber die Gesamtverifikation ist noch nicht bestaetigt. Bitte Re-Check ausfuehren.",
    );
  }

  return params.verification;
}

export function getEasLinkPresentation(state: EasLinkStatus, detail?: string): EasLinkPresentation {
  if (state === "verified") {
    return {
      state,
      label: "Verifiziert",
      tone: "ok",
      detail: detail || "Workflow und EAS-Projektdatei sind sauber verifiziert.",
    };
  }

  if (state === "workflow_missing") {
    return {
      state,
      label: "Workflow fehlt",
      tone: "error",
      detail: detail || "Der EAS-Link-Workflow fehlt im Ziel-Repo.",
    };
  }

  if (state === "project_missing") {
    return {
      state,
      label: "Projektdatei fehlt",
      tone: "error",
      detail: detail || "`eas-project.json` fehlt im Ziel-Repo.",
    };
  }

  if (state === "project_invalid") {
    return {
      state,
      label: "Projektdatei ungueltig",
      tone: "error",
      detail: detail || "`eas-project.json` ist vorhanden, aber ungueltig.",
    };
  }

  if (state === "project_mismatch") {
    return {
      state,
      label: "ID mismatch",
      tone: "error",
      detail: detail || "Die Repo-Project-ID passt nicht zur erwarteten EAS Project ID.",
    };
  }

  if (state === "auth_error") {
    return {
      state,
      label: "Zugriff unklar",
      tone: "warn",
      detail: detail || "GitHub-Zugriff reicht fuer eine sichere Verifikation aktuell nicht aus.",
    };
  }

  if (state === "pending_recheck") {
    return {
      state,
      label: "Re-Check noetig",
      tone: "neutral",
      detail: detail || "Aenderung geschrieben, aber noch nicht voll verifiziert.",
    };
  }

  return {
    state,
    label: "Unklar",
    tone: "neutral",
    detail: detail || "EAS-Link-Zustand ist aktuell nicht sicher verifizierbar.",
  };
}
