export const ERR_BRANCH_MISSING = "BRANCH_MISSING" as const;
export const ERR_DIAGNOSTIC_NOT_GREEN = "DIAGNOSTIC_NOT_GREEN" as const;

export const BUILD_READINESS_ERROR_MESSAGES = {
  [ERR_BRANCH_MISSING]: "Branch fehlt (im Repo-Screen auswaehlen)",
  [ERR_DIAGNOSTIC_NOT_GREEN]: "Diagnostik nicht gruen – im Diagnostic-Screen ausfuehren",
} as const;

export type BuildReadinessErrorCode = keyof typeof BUILD_READINESS_ERROR_MESSAGES;
