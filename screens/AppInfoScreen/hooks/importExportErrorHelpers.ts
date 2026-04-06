function hasStringMessage(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

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
  if (hasStringMessage(error)) {
    const message = error.message.trim();
    return message || fallback;
  }
  return fallback;
};

const ABORT_MARKERS = ["abgebrochen", "cancelled", "canceled"] as const;
const CLEANUP_IGNORABLE_MARKERS = [
  "no such file or directory",
  "does not exist",
  "enoent",
] as const;

export const isImportExportAborted = (error: unknown): boolean => {
  const message = getImportExportErrorMessage(error, "").toLowerCase();
  return ABORT_MARKERS.some((marker) => message.includes(marker));
};

export const isIgnorableImportExportCleanupError = (error: unknown): boolean => {
  if (isImportExportAborted(error)) return true;
  const message = getImportExportErrorMessage(error, "").toLowerCase();
  return CLEANUP_IGNORABLE_MARKERS.some((marker) => message.includes(marker));
};
