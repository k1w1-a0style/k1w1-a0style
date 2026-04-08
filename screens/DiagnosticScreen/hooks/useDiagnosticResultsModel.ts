import { useCallback, useMemo } from "react";
import type { BuildMode } from "../../../components/diagnostics/ModeSelector";
import type { IssueDetail } from "../../../components/diagnostics/IssueDetailSheet";
import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";
import type { Status } from "../types";
import { ORDER } from "./diagnosticRunners";
import { useDiagnosticIssueFiltering } from "./useDiagnosticIssueFiltering";
import { pipelineCheckAppliesToModes } from "./diagnosticPipelineModeRules";

export function useDiagnosticResultsModel(params: {
  results: PreflightCheckResult[];
  modesAll: boolean;
  selectedModes: BuildMode[];
  recommendedMode: BuildMode;
}) {
  const { results, modesAll, selectedModes, recommendedMode } = params;

  const counts = useMemo(() => {
    const c = { pass: 0, warn: 0, fail: 0 };
    for (const r of results) {
      const st = (r.status ?? "pass") as Status;
      c[st] += 1;
    }
    return c;
  }, [results]);

  const sortedResults = useMemo(() => {
    const list = [...results];
    list.sort(
      (a, b) =>
        ORDER[(a.status as Status) ?? "pass"] -
        ORDER[(b.status as Status) ?? "pass"],
    );
    return list;
  }, [results]);

  const { issuesFilter, setIssuesFilter, visibleResults } = useDiagnosticIssueFiltering(sortedResults);

  const toSeverity = useCallback((s: Status): IssueDetail["severity"] => {
    if (s === "fail") return "critical";
    if (s === "warn") return "warning";
    return "info";
  }, []);

  const fixableResults = useMemo(() => {
    const list = sortedResults.filter((r) => !!r.fix?.patch);
    list.sort(
      (a, b) =>
        ORDER[(a.status as Status) ?? "pass"] -
        ORDER[(b.status as Status) ?? "pass"],
    );
    return list;
  }, [sortedResults]);

  const pipelineAppliesToFocus = useCallback(
    (id: string): boolean =>
      pipelineCheckAppliesToModes({
        checkId: id,
        modesAll,
        selectedModes,
        recommendedMode,
      }),
    [modesAll, recommendedMode, selectedModes],
  );

  return {
    counts,
    sortedResults,
    issuesFilter,
    setIssuesFilter,
    visibleResults,
    toSeverity,
    fixableResults,
    pipelineAppliesToFocus,
  };
}
