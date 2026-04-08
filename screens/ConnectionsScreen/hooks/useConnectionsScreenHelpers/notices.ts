export type ConnectionsAlertNoticeKey =
  | "missing_github_token"
  | "missing_repo_selection"
  | "missing_branch_selection"
  | "invalid_repo_format"
  | "create_link_workflow_started";

export type EasWorkflowSelectionPrecheckResult =
  | {
      ok: true;
      selection: {
        githubToken: string;
        repoSlug: string;
        branch: string;
      };
    }
  | {
      ok: false;
      notice: { title: string; message: string };
    };

export type EasWorkflowLaunchSelectionResult =
  | {
      ok: true;
      selection: {
        githubToken: string;
        repoSlug: string;
        branch: string;
        owner: string;
        repo: string;
      };
    }
  | {
      ok: false;
      notice: { title: string; message: string };
    };

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

export const resolveEasWorkflowSelectionPrecheck = (params: {
  githubToken: string;
  repoSlug: string;
  branch: string;
}): EasWorkflowSelectionPrecheckResult => {
  const githubToken = params.githubToken.trim();
  if (!githubToken) {
    return {
      ok: false,
      notice: resolveConnectionsAlertNotice("missing_github_token"),
    };
  }

  const repoSlug = params.repoSlug.trim();
  if (!repoSlug) {
    return {
      ok: false,
      notice: resolveConnectionsAlertNotice("missing_repo_selection"),
    };
  }

  const branch = params.branch.trim();
  if (!branch) {
    return {
      ok: false,
      notice: resolveConnectionsAlertNotice("missing_branch_selection"),
    };
  }

  return {
    ok: true,
    selection: {
      githubToken,
      repoSlug,
      branch,
    },
  };
};

export const resolveEasWorkflowLaunchSelection = (params: {
  githubToken: string;
  repoSlug: string;
  branch: string;
  parseOwnerRepo: (repoSlug: string) => { owner: string; repo: string } | null;
}): EasWorkflowLaunchSelectionResult => {
  const precheck = resolveEasWorkflowSelectionPrecheck({
    githubToken: params.githubToken,
    repoSlug: params.repoSlug,
    branch: params.branch,
  });
  if (!precheck.ok) {
    return precheck;
  }

  const parsed = params.parseOwnerRepo(precheck.selection.repoSlug);
  if (!parsed) {
    return {
      ok: false,
      notice: resolveConnectionsAlertNotice("invalid_repo_format"),
    };
  }

  return {
    ok: true,
    selection: {
      ...precheck.selection,
      owner: parsed.owner,
      repo: parsed.repo,
    },
  };
};

export const resolveConnectionsActionAlert = (params: {
  isBusy: boolean;
  error: unknown;
  defaultTitle: string;
}): { title: string; message: string } => {
  if (params.isBusy) {
    return {
      title: "Bitte warten",
      message:
        params.error instanceof Error && params.error.message
          ? params.error.message
          : "Eine andere Aktion läuft bereits.",
    };
  }

  const message =
    params.error instanceof Error && params.error.message
      ? params.error.message
      : typeof params.error === "string" && params.error.trim()
        ? params.error
        : "Unbekannter Fehler";

  return {
    title: params.defaultTitle,
    message,
  };
};
