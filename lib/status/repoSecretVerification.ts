import {
  normalizeVerificationContract,
  type VerificationContract,
} from "./verificationContract";

export function resolveRepoSecretVerification(params: {
  name: string;
  names?: readonly string[] | null;
  error?: unknown;
  stale?: boolean;
}): VerificationContract {
  if (Array.isArray(params.names)) {
    return normalizeVerificationContract({
      explicitState: params.names.includes(params.name) ? "verified" : "missing",
    });
  }

  return normalizeVerificationContract({
    stale: params.stale,
    error: params.error,
  });
}

export function resolveRepoSecretListVerification(params: {
  names?: readonly string[] | null;
  error?: unknown;
  stale?: boolean;
}): VerificationContract {
  if (Array.isArray(params.names)) {
    return normalizeVerificationContract({ explicitState: "verified" });
  }

  return normalizeVerificationContract({
    stale: params.stale,
    error: params.error,
  });
}
