import type { CheckItem } from "../components/ChecklistSection";
import type { BuildProfile } from "../types";
import type { RepoSyncState } from "../../../lib/repoSyncOrchestration";

export type BuildBlockedAction = {
  title: string;
  detail: string;
  ctaLabel: string;
  screen: "GitHubRepos" | "Connections" | "Diagnostic" | "CredentialsWizard";
  params?: Record<string, unknown>;
};

export function resolveBuildBlockedAction(params: {
  repoValidationValid: boolean;
  branchName: string;
  hasTokens: boolean;
  hasWorkflowAdminKey: boolean;
  hasOperatorJwt: boolean;
  hasDiagOk: boolean;
  hasCiLiteOk: boolean;
  repoSyncState: RepoSyncState;
  hasSigningKey: boolean;
  buildBlockedReason: string | null;
}): BuildBlockedAction | null {
  const {
    repoValidationValid,
    branchName,
    hasTokens,
    hasWorkflowAdminKey,
    hasOperatorJwt,
    hasDiagOk,
    hasCiLiteOk,
    repoSyncState,
    hasSigningKey,
    buildBlockedReason,
  } = params;

  if (!repoValidationValid || !branchName.trim()) {
    return {
      title: "Repo/Branch zuerst verknüpfen",
      detail: buildBlockedReason || "Ohne Selection sind Diagnostik, CI-Lite und Build-Gates absichtlich nicht grün.",
      ctaLabel: "GitHub-Repos öffnen",
      screen: "GitHubRepos",
    };
  }
  if (!hasTokens) {
    return {
      title: "Tokens fehlen",
      detail: buildBlockedReason || "GitHub- und Expo-Token zuerst im Verbindungen-Screen setzen.",
      ctaLabel: "Verbindungen öffnen",
      screen: "Connections",
    };
  }
  if (!hasWorkflowAdminKey || !hasOperatorJwt) {
    return {
      title: "Clientseitiger Operator-Precheck fehlt",
      detail:
        buildBlockedReason ||
        "Workflow-Admin-Key und Supabase Operator-JWT-Precheck (build_admin/service_role) fehlen. Clientseitig wird nur JWT-Payload gelesen (ohne Signaturprüfung); maßgeblich bleibt die server-/edge-seitige Autorisierung.",
      ctaLabel: "Verbindungen öffnen",
      screen: "Connections",
    };
  }
  if (!hasDiagOk) {
    return {
      title: "Diagnostik fehlt oder passt nicht zur Selection",
      detail: buildBlockedReason || "Diagnostik für dieses Repo/Branch erneut ausführen.",
      ctaLabel: "Diagnostic öffnen",
      screen: "Diagnostic",
      params: { autoRun: true },
    };
  }
  if (!hasCiLiteOk) {
    return {
      title: "CI-Lite nicht sicher grün",
      detail: buildBlockedReason || "CI-Lite für dieses Repo/Branch erneut laufen lassen.",
      ctaLabel: "GitHub-Repos öffnen",
      screen: "GitHubRepos",
    };
  }
  if (repoSyncState === "unknown") {
    return {
      title: "Repo-Sync unklar",
      detail: buildBlockedReason || "Einmal explizit pushen, damit der Sync-Status materialisiert wird.",
      ctaLabel: "GitHub-Repos öffnen",
      screen: "GitHubRepos",
    };
  }
  if (!hasSigningKey) {
    return {
      title: "Signing-Key fehlt",
      detail: buildBlockedReason || "Den Wizard öffnen und den Signing-Key prüfen oder erzeugen.",
      ctaLabel: "Wizard öffnen",
      screen: "CredentialsWizard",
    };
  }
  return null;
}

export function createChecklistItems(params: {
  buildProfile: BuildProfile;
  repoFullName: string;
  branchName: string;
  hasSigningKey: boolean;
  signingKeyReason: string | null;
  hasTokens: boolean;
  tokenReason: string | null;
  hasWorkflowAdminKey: boolean;
  workflowAdminKeyReason: string | null;
  hasOperatorJwt: boolean;
  operatorJwtReason: string | null;
  hasDiagOk: boolean;
  diagnosticReason: string | null;
  hasCiLiteOk: boolean;
  ciLiteReason: string | null;
  hasProjectFiles: boolean;
  projectFilesReason: string | null;
  repoSyncState: RepoSyncState;
  repoSyncReason: string | null;
  projectFilesCount: number;
}): CheckItem[] {
  const {
    buildProfile,
    repoFullName,
    branchName,
    hasSigningKey,
    signingKeyReason,
    hasTokens,
    tokenReason,
    hasWorkflowAdminKey,
    workflowAdminKeyReason,
    hasOperatorJwt,
    operatorJwtReason,
    hasDiagOk,
    diagnosticReason,
    hasCiLiteOk,
    ciLiteReason,
    hasProjectFiles,
    projectFilesReason,
    repoSyncState,
    repoSyncReason,
    projectFilesCount,
  } = params;

  const hasRepo = !!repoFullName.trim();
  const hasBranch = !!branchName.trim();

  return [
    {
      id: "signing_key",
      label: "Signing-Key bereit",
      status: hasSigningKey ? "ok" : "fail",
      detail: hasSigningKey
        ? `${buildProfile} · letzter bekannter Wizard-Stand`
        : (signingKeyReason || "Fehlt noch - im Wizard prüfen oder erzeugen"),
    },
    {
      id: "tokens",
      label: "Tokens vorhanden (GitHub + Expo)",
      status: hasTokens ? "ok" : "fail",
      detail: hasTokens ? undefined : (tokenReason || "Im Verbindungen-Screen setzen"),
    },
    {
      id: "workflow_admin_key",
      label: "Workflow-Admin-Key vorhanden",
      status: hasWorkflowAdminKey ? "ok" : "fail",
      detail: hasWorkflowAdminKey
        ? "Lokaler Workflow-Admin-Key verfügbar"
        : (workflowAdminKeyReason || "Workflow-Admin-Key im Verbindungen-Screen setzen"),
    },
    {
      id: "operator_jwt",
      label: "Operator-JWT-Precheck (clientseitig)",
      status: hasOperatorJwt ? "ok" : "fail",
      detail: hasOperatorJwt
        ? "Clientseitiger JWT-Payload-Precheck erfüllt (decode-only, ohne Signaturprüfung); server-/edge-seitige Prüfung bleibt maßgeblich"
        : (operatorJwtReason || "Supabase Operator-JWT-Precheck fehlt (clientseitig, decode-only ohne Signaturprüfung); server-/edge-seitige Autorisierung bleibt maßgeblich"),
    },
    {
      id: "diagnostic",
      label: "Diagnose erfolgreich",
      status: hasDiagOk ? "ok" : "pending",
      detail: hasDiagOk
        ? "Letzter bekannter Diagnose-Check: OK"
        : (!hasRepo || !hasBranch
          ? "Repo und Branch zuerst wählen – dann Diagnostik für genau diese Selection ausführen"
          : (diagnosticReason || "Diagnose ausfuehren")),
    },
    {
      id: "ci_lite",
      label: "Code-Checks grün (CI Lite)",
      status: hasCiLiteOk ? "ok" : "pending",
      detail: hasCiLiteOk
        ? "Letzter bekannter CI-Lite-Run: OK"
        : (!hasRepo || !hasBranch
          ? "Repo und Branch zuerst wählen – dann CI-Lite für genau diese Selection ausführen"
          : (ciLiteReason || "Im Header CI Lite ausführen")),
    },
    {
      id: "repo",
      label: "Repo gewaehlt",
      status: hasRepo ? "ok" : "fail",
      detail: hasRepo ? repoFullName : "Im GitHub-Repos-Screen verknuepfen",
    },
    {
      id: "branch",
      label: "Branch gewaehlt",
      status: hasBranch ? "ok" : "fail",
      detail: hasBranch ? branchName : "Im GitHub-Repos-Screen auswaehlen",
    },
    {
      id: "project_files",
      label: "Projektdateien vorhanden",
      status: hasProjectFiles ? "ok" : "fail",
      detail: hasProjectFiles
        ? `${projectFilesCount} Dateien im Projekt`
        : (projectFilesReason || "Projekt ist leer – zuerst Dateien erzeugen oder importieren"),
    },
    {
      id: "repo_sync",
      label: "Repo-Sync lokal ↔ Repo bekannt",
      status: !hasRepo || !hasBranch ? "pending" : !hasProjectFiles ? "pending" : repoSyncState === "unknown" ? "fail" : "ok",
      detail: !hasRepo || !hasBranch
        ? "Repo und Branch zuerst wählen"
        : !hasProjectFiles
          ? "Repo-Sync wird relevant, sobald Dateien im Projekt vorhanden sind"
          : repoSyncState === "unknown"
            ? (repoSyncReason || "Bitte einmal explizit pushen, damit der Sync-Status materialisiert wird")
            : repoSyncState === "out_of_sync"
              ? "Lokale Dateien weichen ab – der Build-Start pusht kontrolliert vor dem Dispatch"
              : (repoSyncReason || "Lokaler Stand ist für diese Selection bereits bekannt"),
    },
    {
      id: "build_mode",
      label: `Build = ${buildProfile}`,
      status: "ok",
      detail: `Profil: ${buildProfile}`,
    },
  ];
}
