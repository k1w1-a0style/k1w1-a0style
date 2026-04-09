import { useMemo } from "react";

import { BuildErrorAnalyzer } from "../../../lib/buildErrorAnalyzer";
import type { LogEntry } from "../../../hooks/useGitHubActionsLogs";

import { sanitizeUiMessage } from "./buildScreenHelpers";
import { mapWorkflowLogsToLines } from "./enhancedBuildScreenOrchestration";

export function useEnhancedBuildLogState(params: {
  logs: LogEntry[] | null | undefined;
  logsError: string | null;
}) {
  const analyses = useMemo(() => {
    if (!params.logs || params.logs.length === 0) return [];
    return BuildErrorAnalyzer.analyzeLogs(params.logs);
  }, [params.logs]);

  const logsErrorSafe = useMemo(() => {
    return params.logsError ? sanitizeUiMessage(params.logsError) : null;
  }, [params.logsError]);

  const logLines = useMemo(() => mapWorkflowLogsToLines(params.logs), [params.logs]);

  return {
    analyses,
    logsErrorSafe,
    logLines,
  };
}
