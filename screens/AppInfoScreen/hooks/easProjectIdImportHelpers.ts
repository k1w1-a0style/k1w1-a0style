export type EasProjectIdImportDecision =
  | { mode: "set"; value: string }
  | { mode: "clear" }
  | { mode: "skip-invalid"; value: string };

const EAS_PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveEasProjectIdImportDecision(rawValue: string | null | undefined): EasProjectIdImportDecision {
  const trimmed = (rawValue ?? "").trim();
  if (!trimmed) {
    return { mode: "clear" };
  }
  if (!EAS_PROJECT_ID_PATTERN.test(trimmed)) {
    return { mode: "skip-invalid", value: trimmed };
  }
  return { mode: "set", value: trimmed };
}
