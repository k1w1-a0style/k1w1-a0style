const GUARD_HINT_MARKERS = [
  "manual-only",
  "kritisch",
  "read-only",
  "baseline",
  "template/baseline",
  "ownership block",
  "guarded",
] as const;

function includesGuardMarker(input: string): boolean {
  const lower = input.toLowerCase();
  return GUARD_HINT_MARKERS.some((marker) => lower.includes(marker));
}

export function hasGuardHint(entries: Array<string | null | undefined> | null | undefined): boolean {
  if (!entries?.length) return false;
  return entries.some((entry) => includesGuardMarker(String(entry ?? "")));
}

export function extractGuardHints(entries: Array<string | null | undefined> | null | undefined): string[] {
  if (!entries?.length) return [];
  return entries
    .map((entry) => String(entry ?? ""))
    .filter((entry) => includesGuardMarker(entry));
}
