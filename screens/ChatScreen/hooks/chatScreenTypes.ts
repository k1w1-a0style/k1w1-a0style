// screens/ChatScreen/hooks/chatScreenTypes.ts
// Shared ChatScreen constants/types/helpers.

export type DocumentResultAsset = NonNullable<
  import("expo-document-picker").DocumentPickerResult["assets"]
>[0];

export type AttachmentNoticeAsset = Pick<DocumentResultAsset, "name" | "size">;

export const INPUT_BAR_MIN_H = 56;

// Composer 1–2px näher an die Tastatur (wenn offen)
export const KEYBOARD_NUDGE = 2;

export const FOOTER_LIFT_WHEN_BUSY = 72;

const FILE_SIZE_ANALYSIS_HINT_LIMIT_BYTES = 100 * 1024;

export function buildUserInputWithAttachmentNotice(
  textInput: string,
  selectedFileAsset: AttachmentNoticeAsset | null,
): string {
  const base = textInput.trim();
  if (!selectedFileAsset) return base;

  const fileName = selectedFileAsset.name || "(ohne Dateiname)";
  const sizeHint =
    typeof selectedFileAsset.size === "number" && selectedFileAsset.size > 0
      ? ` (${(selectedFileAsset.size / 1024).toFixed(1)} KB)`
      : "";

  const attachmentNote =
    typeof selectedFileAsset.size === "number" &&
    selectedFileAsset.size > FILE_SIZE_ANALYSIS_HINT_LIMIT_BYTES
      ? `

📎 Anhang gewählt: ${fileName}${sizeHint}. Hinweis: Aktuell wird nur Dateiname/Metadaten übergeben, nicht der vollständige Dateiinhalt.`
      : `

📎 Anhang gewählt: ${fileName}${sizeHint}. Hinweis: Aktuell wird nur Dateiname/Metadaten übergeben.`;

  return base ? `${base}${attachmentNote}` : attachmentNote.trim();
}
