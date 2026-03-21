export const BUILD_READINESS_REASON_CODES = {
  INVALID_REPO: "invalid_repo",
  MISSING_BRANCH: "missing_branch",
  DIAGNOSTIC_NOT_GREEN: "diagnostic_not_green",
  CI_LITE_MISSING: "ci_lite_missing",
  CI_LITE_STALE: "ci_lite_stale",
  CI_LITE_INVALID_SHA: "ci_lite_invalid_sha",
  CI_LITE_SHA_MISMATCH: "ci_lite_sha_mismatch",
  CI_LITE_REPO_MISMATCH: "ci_lite_repo_mismatch",
  CI_LITE_BRANCH_MISMATCH: "ci_lite_branch_mismatch",
  CI_LITE_NOT_GREEN: "ci_lite_not_green",
  CI_LITE_HEAD_UNVERIFIED: "ci_lite_head_unverified",
  CI_LITE_INVALID_SNAPSHOT: "ci_lite_invalid_snapshot",
} as const;

export const BUILD_READINESS_REASON_MESSAGES = {
  [BUILD_READINESS_REASON_CODES.INVALID_REPO]:
    'Kein gueltiges Ziel-Repo verknuepft. Bitte in "Connections" ein Repo auswaehlen.',
  [BUILD_READINESS_REASON_CODES.MISSING_BRANCH]: "Branch fehlt (im Repo-Screen auswaehlen)",
  [BUILD_READINESS_REASON_CODES.DIAGNOSTIC_NOT_GREEN]:
    "Diagnostik nicht gruen – im Diagnostic-Screen ausfuehren",
  [BUILD_READINESS_REASON_CODES.CI_LITE_MISSING]:
    "CI-Lite-Persistenz fehlt oder ist unvollstaendig",
  [BUILD_READINESS_REASON_CODES.CI_LITE_STALE]: "CI-Lite ist veraltet",
  [BUILD_READINESS_REASON_CODES.CI_LITE_INVALID_SHA]:
    "CI-Lite-SHA fehlt oder ist ungueltig",
  [BUILD_READINESS_REASON_CODES.CI_LITE_SHA_MISMATCH]:
    "Repo/Branch wurden seit dem letzten CI-Lite-Run geaendert (SHA-Mismatch)",
  [BUILD_READINESS_REASON_CODES.CI_LITE_REPO_MISMATCH]:
    "CI-Lite gehoert zu anderem Repo",
  [BUILD_READINESS_REASON_CODES.CI_LITE_BRANCH_MISMATCH]:
    "CI-Lite gehoert zu anderem Branch",
  [BUILD_READINESS_REASON_CODES.CI_LITE_NOT_GREEN]: "CI-Lite Lint/Typecheck nicht gruen",
  [BUILD_READINESS_REASON_CODES.CI_LITE_HEAD_UNVERIFIED]:
    "Branch-HEAD-SHA konnte nicht verifiziert werden",
  [BUILD_READINESS_REASON_CODES.CI_LITE_INVALID_SNAPSHOT]:
    "CI-Lite-Snapshot ist ungueltig oder passt nicht zur Persistenz",
} as const;

export type BuildReadinessReasonCode =
  (typeof BUILD_READINESS_REASON_CODES)[keyof typeof BUILD_READINESS_REASON_CODES];

export function formatBuildReadinessFailure(params: {
  reasonCode: BuildReadinessReasonCode;
  message: string;
}): string {
  return `${params.reasonCode}: ${params.message}`;
}

export function getBuildReadinessMessage(reasonCode: BuildReadinessReasonCode): string {
  return BUILD_READINESS_REASON_MESSAGES[reasonCode];
}
