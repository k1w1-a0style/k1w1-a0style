export type VerificationContractState =
  | "verified"
  | "missing"
  | "unknown"
  | "auth_error"
  | "stale";

export type VerificationContract = {
  state: VerificationContractState;
  isVerified: boolean;
  isHardMissing: boolean;
  isUncertain: boolean;
};

export function isAuthOrPermissionStatus(statusCode?: number | null): boolean {
  return statusCode === 401 || statusCode === 403;
}

export function classifyVerificationError(params: {
  statusCode?: number | null;
  error?: unknown;
}): Exclude<VerificationContractState, "verified" | "missing" | "stale"> {
  if (isAuthOrPermissionStatus(params.statusCode)) return "auth_error";

  const message = String(
    typeof params.error === "string"
      ? params.error
      : (params.error as { message?: unknown } | null | undefined)?.message ?? "",
  ).toLowerCase();

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("forbidden") ||
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("not authorized") ||
    message.includes("access denied")
  ) {
    return "auth_error";
  }

  return "unknown";
}

export function normalizeVerificationContract(params: {
  configured?: boolean;
  verified?: boolean;
  stale?: boolean;
  statusCode?: number | null;
  error?: unknown;
  explicitState?: VerificationContractState | null;
}): VerificationContract {
  const explicitState = params.explicitState ?? null;
  const state: VerificationContractState = explicitState
    ? explicitState
    : params.configured === false
      ? "missing"
      : params.stale
        ? "stale"
        : params.verified
          ? "verified"
          : params.statusCode || params.error
            ? classifyVerificationError({ statusCode: params.statusCode, error: params.error })
            : "unknown";

  return {
    state,
    isVerified: state === "verified",
    isHardMissing: state === "missing",
    isUncertain: state === "unknown" || state === "auth_error" || state === "stale",
  };
}
