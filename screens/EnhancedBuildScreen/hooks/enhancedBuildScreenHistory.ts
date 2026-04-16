import type { BuildHistoryEntry } from "../../../shared/types/build";
import type { ModeFilter } from "./runFilterState";

export function filterBuildHistoryByMode(
  history: BuildHistoryEntry[] | null | undefined,
  filter: ModeFilter,
): BuildHistoryEntry[] {
  const all = history ?? [];
  if (filter === "all") return all;
  const needle = String(filter).toLowerCase();
  return all.filter((entry) => String(entry.buildProfile || "").toLowerCase() === needle);
}

export function summarizeBuildHistoryStats(history: BuildHistoryEntry[] | null | undefined): {
  total: number;
  success: number;
  failed: number;
  building: number;
} {
  const list = history ?? [];
  return {
    total: list.length,
    success: list.filter((entry) => entry.status === "success").length,
    failed: list.filter((entry) => entry.status === "failed" || entry.status === "error").length,
    building: list.filter((entry) => entry.status === "starting" || entry.status === "building" || entry.status === "queued").length,
  };
}
