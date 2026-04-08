import type { PreviewEdgeErrorCode } from "../../shared/previewErrorContract";

export const PREVIEW_EDGE_ERROR_MESSAGES: Record<PreviewEdgeErrorCode, string> = {
  preview_env_missing: "Remote-Preview blockiert: Der Preview-Server ist nicht vollstaendig konfiguriert.",
  preview_db_error: "Remote-Preview konnte serverseitig nicht gespeichert oder geladen werden.",
  preview_payload_invalid: "Remote-Preview hat ungueltige oder leere Dateien erhalten.",
  preview_payload_too_large: "Remote-Preview ist zu gross fuer den Serververtrag.",
  preview_not_found: "Remote-Preview wurde auf dem Server nicht gefunden.",
  preview_expired: "Remote-Preview ist bereits abgelaufen. Bitte neu erstellen.",
  preview_response_too_large: "Remote-Preview konnte nicht ausgeliefert werden, weil die Antwort zu gross wurde.",
  preview_runtime_error: "Remote-Preview ist serverseitig beim Rendern fehlgeschlagen.",
  preview_unknown_internal_error: "Remote-Preview ist serverseitig intern fehlgeschlagen.",
};

export const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
  ".md",
  ".mdx",
  ".txt",
  ".svg",
  ".graphql",
  ".gql",
]);

export const IGNORED_PATTERNS = [
  "node_modules/",
  ".expo/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  ".cache/",
  "__tests__/",
  "__mocks__/",
];

export const EMPTY_REMOTE_PREVIEW_FILES_ERROR =
  "Keine zulaessigen Projektdateien fuer Remote-Preview gefunden.";
