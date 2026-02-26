// utils/chatUtils.ts
// REFACTORED: split into chatValidation.ts + chatJsonUtils.ts
// Re-exports everything for backward compatibility.

export {
  normalizePath, ensureStringContent, getCodeLineCount,
  hasValidExtension, hasInvalidPattern, isPathAllowed, isCodeFile,
  validateFilePath, validateProjectFiles,
} from "./chatValidation";

export {
  safeJsonParse, safeJsonParseSilent,
  extractJsonArray, isJsonTruncated,
} from "./chatJsonUtils";
