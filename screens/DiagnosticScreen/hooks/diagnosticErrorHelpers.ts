export function getDiagnosticUiErrorMessage(error: unknown, fallback = "Unbekannter Fehler"): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed || fallback;
  }
  return fallback;
}
