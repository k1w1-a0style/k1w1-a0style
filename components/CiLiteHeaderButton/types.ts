// components/CiLiteHeaderButton/types.ts

export { type StepState } from "../ciLite/ciLiteUtils";

export const WORKFLOW_CI_LITE = "k1w1-ci-lite.yml";
export const WORKFLOW_CI_LITE_AUTOFIX = "k1w1-ci-lite-autofix.yml";

export interface RunMeta {
  id: number | string;
  runNumber: number;
  status: string;
  conclusion: string;
  duration: string;
  url: string | null;
  updatedAt: string | undefined;
}
