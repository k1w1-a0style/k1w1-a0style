import { safeTruncateText } from "../../../lib/diagnostics/sanitize";
import { DiagnosticFixApplyError } from "../../../lib/diagnostics/fixResultContract";

export type FixRuntimeMeta = { localChangeApplied?: boolean; partial?: boolean };

type FailedStepPatch = { status: "failed"; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

export const getFixRuntimeMeta = (error: unknown): FixRuntimeMeta => {
  if (!isRecord(error)) return {};
  return {
    localChangeApplied: typeof error.localChangeApplied === "boolean" ? error.localChangeApplied : undefined,
    partial: typeof error.partial === "boolean" ? error.partial : undefined,
  };
};

export const buildFailedStepPatch = (
  error: unknown,
  fallback: string,
  maxLength = 160,
): FailedStepPatch => ({
  status: "failed",
  message: safeTruncateText(getErrorMessage(error, fallback), maxLength),
});

export const buildApplyFailureResult = (params: {
  error: unknown;
  fallback: string;
  stepIndex: number;
  localChangeApplied?: boolean;
  partial?: boolean;
}) => {
  const { error, fallback, stepIndex, localChangeApplied, partial } = params;
  const runtimeMeta = getFixRuntimeMeta(error);
  return {
    status: error instanceof DiagnosticFixApplyError ? error.status : "failed",
    detail: getErrorMessage(error, fallback),
    localChangeApplied: localChangeApplied ?? !!runtimeMeta.localChangeApplied,
    partial: partial ?? !!runtimeMeta.partial,
    stepIndex,
  } as const;
};
