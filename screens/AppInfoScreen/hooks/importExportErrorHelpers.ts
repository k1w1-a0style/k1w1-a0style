export const getImportExportErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || fallback;
  }
  if (typeof error === "string") {
    const message = error.trim();
    return message || fallback;
  }
  return fallback;
};

const ABORT_MARKERS = ["abgebrochen", "cancelled", "canceled"] as const;

export const isImportExportAborted = (error: unknown): boolean => {
  const message = getImportExportErrorMessage(error, "").toLowerCase();
  return ABORT_MARKERS.some((marker) => message.includes(marker));
};
