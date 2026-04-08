import type { VerificationContractState } from "../../../../lib/status/verificationContract";
import type { ExpoProjectResponse } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readNestedRecord = (value: unknown, key: string): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;
  const nested = value[key];
  return isRecord(nested) ? nested : null;
};

const readStringValue = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "string" ? field : undefined;
};

export const parseExpoProjectResponse = (value: unknown): ExpoProjectResponse | null => {
  if (!isRecord(value)) return null;
  const data = readNestedRecord(value, "data");
  if (!data) return null;
  const project = readNestedRecord(data, "project");

  return {
    data: {
      id: readStringValue(data, "id"),
      slug: readStringValue(data, "slug"),
      name: readStringValue(data, "name"),
      project: project
        ? {
            id: readStringValue(project, "id"),
            slug: readStringValue(project, "slug"),
          }
        : undefined,
    },
  };
};

export const hasExpoProject = (payload: ExpoProjectResponse | null): boolean => {
  return Boolean(
    payload?.data?.id ||
      payload?.data?.project?.id ||
      payload?.data?.project?.slug ||
      payload?.data?.slug ||
      payload?.data?.name,
  );
};

export const resolveEasProjectVerification = (
  payload: ExpoProjectResponse | null,
  nowIso: string,
): {
  ok: boolean;
  state: VerificationContractState;
  verifiedAt: string | null;
  hasProject: boolean;
} => {
  const hasProject = hasExpoProject(payload);
  return {
    ok: hasProject,
    state: hasProject ? "verified" : "unknown",
    verifiedAt: hasProject ? nowIso : null,
    hasProject,
  };
};

export const deriveSupabaseRefFromUrl = (url: string): string => {
  const host = url.replace(/^https?:\/\//, "").split("/")[0] || "";
  return host.endsWith(".supabase.co") ? host.split(".")[0] || "" : "";
};
