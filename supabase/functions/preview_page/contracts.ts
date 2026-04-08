import type { PreviewEdgeErrorCode } from "../../../shared/previewErrorContract.ts";

export type PreviewMeta = { template?: unknown };

export interface ParsedPreviewPageRequest {
  url: URL;
  headerSecret: string;
  secret: string;
  showRawLogs: boolean;
  showRuntimeErrors: boolean;
  transport: string;
}

export type PreviewPageErrorCode = PreviewEdgeErrorCode;
