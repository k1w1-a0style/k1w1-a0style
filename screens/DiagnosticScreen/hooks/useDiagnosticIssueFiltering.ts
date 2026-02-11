import { useMemo, useState } from "react";

import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";
import type { Status } from "../types";

export type IssuesFilter = "all" | "critical" | "warning";
/**
 * Holds the issues filter state and computes the visible issue list.
 *
 * We keep the filtering semantics identical to the original implementation.
 */
export function useDiagnosticIssueFiltering(sortedResults: PreflightCheckResult[]) {
  const [issuesFilter, setIssuesFilter] = useState<IssuesFilter>("all");

  const visibleResults = useMemo(() => {
    const nonPass = sortedResults.filter(
      (r) => ((r.status ?? "pass") as Status) !== "pass",
    );
    if (issuesFilter === "all") return nonPass;
    if (issuesFilter === "critical")
      return nonPass.filter((r) => ((r.status ?? "pass") as Status) === "fail");
    if (issuesFilter === "warning")
      return nonPass.filter((r) => ((r.status ?? "pass") as Status) === "warn");
    return nonPass;
  }, [issuesFilter, sortedResults]);

  return {
    issuesFilter,
    setIssuesFilter,
    visibleResults,
  };
}
