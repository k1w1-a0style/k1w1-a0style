import { redactSecrets, truncateWithMarker } from './secretRedaction';

export type HistoryLikeMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta?: {
    localOnly?: boolean;
    metaCommand?: boolean;
    containsFilePreview?: boolean;
  };
};

export type SanitizedLlmMessage = {
  role: HistoryLikeMessage['role'];
  content: string;
};

const SENSITIVE_FILE_PATH_RE = /(^|\/)(\.npmrc|\.env(\.[^/]+)?|id_[a-z0-9_-]+|.*\.pem|.*\.key|.*\.crt|.*\.cer|.*\.p12|.*\.pfx|.*\.jks|.*\.keystore|.*\.mobileprovision)$/i;
const SENSITIVE_FILE_NAME_HINT_RE = /(^|\/)(.*(?:secret|secrets|credential|credentials|token|auth).*)$/i;
const SENSITIVE_CONTENT_HINT_RE = /(BEGIN [A-Z ]+PRIVATE KEY|npm_[A-Za-z0-9]{10,}|_authToken=|authorization\s*[:=]|api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|refresh[_-]?token\s*[:=])/i;

export const PROMPT_FILE_CONTENT_LIMIT = 8_000;

export function sanitizeTextForLlm(input: string): string {
  return redactSecrets(String(input ?? ''));
}

export function shouldStronglyRedactFile(path: string, content: string): boolean {
  const normalizedPath = String(path ?? '').trim();
  const safeContent = String(content ?? '');
  return (
    SENSITIVE_FILE_PATH_RE.test(normalizedPath) ||
    SENSITIVE_FILE_NAME_HINT_RE.test(normalizedPath) ||
    SENSITIVE_CONTENT_HINT_RE.test(safeContent)
  );
}

export function sanitizeFileContentForPrompt(
  path: string,
  content: string,
  maxChars = PROMPT_FILE_CONTENT_LIMIT,
): string {
  const safePath = String(path ?? '').trim() || '(unbekannter Pfad)';
  const safeContent = String(content ?? '');

  if (shouldStronglyRedactFile(safePath, safeContent)) {
    return `[redacted sensitive file content from ${safePath}]`;
  }

  return truncateWithMarker(sanitizeTextForLlm(safeContent), maxChars);
}

export function shouldIncludeMessageInLlmHistory(message: HistoryLikeMessage): boolean {
  if (message.meta?.localOnly) return false;
  if (message.meta?.metaCommand) return false;
  if (message.meta?.containsFilePreview) return false;
  return String(message.content ?? '').trim().length > 0;
}

export function buildSanitizedLlmHistory(messages: HistoryLikeMessage[]): SanitizedLlmMessage[] {
  return messages
    .filter(shouldIncludeMessageInLlmHistory)
    .map((message) => ({
      role: message.role,
      content: sanitizeTextForLlm(message.content),
    }));
}
