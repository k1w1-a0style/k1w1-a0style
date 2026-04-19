import type { ProjectFile } from "../shared/types/project";
import { truncateWithMarker } from "./secretRedaction";

export type ChangePreview = {
  path: string;
  kind: "new" | "updated";
  preview: string;
  beforeSnippet?: string;
  afterSnippet?: string;
  diffSnippet?: string;
  truncated: boolean;
};

const NEW_FILE_PREVIEW_CHARS = 500;
const CHANGED_SNIPPET_CHARS = 260;
const MAX_DIFF_LINES = 8;

function snippetLines(text: string, maxChars: number): { text: string; truncated: boolean } {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n");
  const limited = truncateWithMarker(normalized, maxChars);
  return {
    text: limited,
    truncated: limited !== normalized,
  };
}

function buildCompactDiff(before: string, after: string): { diffSnippet: string; beforeSnippet: string; afterSnippet: string; truncated: boolean } {
  const beforeLines = String(before ?? "").replace(/\r\n/g, "\n").split("\n");
  const afterLines = String(after ?? "").replace(/\r\n/g, "\n").split("\n");

  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const beforeDelta = beforeLines.slice(prefix, Math.max(prefix, beforeLines.length - suffix));
  const afterDelta = afterLines.slice(prefix, Math.max(prefix, afterLines.length - suffix));
  const contextStart = Math.max(0, prefix - 1);
  const beforeContext = beforeLines.slice(contextStart, prefix);
  const commonTail = suffix > 0 ? afterLines.slice(afterLines.length - 1, afterLines.length) : [];

  const diffLines: string[] = [];
  if (contextStart > 0) diffLines.push("…");
  beforeContext.forEach((line) => diffLines.push(`  ${line}`));
  beforeDelta.forEach((line) => diffLines.push(`- ${line}`));
  afterDelta.forEach((line) => diffLines.push(`+ ${line}`));
  commonTail.forEach((line) => diffLines.push(`  ${line}`));

  const limitedDiff = diffLines.slice(0, MAX_DIFF_LINES);
  const diffWasTruncated = diffLines.length > limitedDiff.length;
  if (diffWasTruncated) limitedDiff.push("…");

  const beforeSnippet = snippetLines(beforeDelta.join("\n") || beforeLines.slice(0, 4).join("\n"), CHANGED_SNIPPET_CHARS);
  const afterSnippet = snippetLines(afterDelta.join("\n") || afterLines.slice(0, 4).join("\n"), CHANGED_SNIPPET_CHARS);

  return {
    diffSnippet: limitedDiff.join("\n"),
    beforeSnippet: beforeSnippet.text,
    afterSnippet: afterSnippet.text,
    truncated: diffWasTruncated || beforeSnippet.truncated || afterSnippet.truncated,
  };
}

export function buildChangePreviews(params: {
  baseFiles: ProjectFile[];
  finalFiles: ProjectFile[];
  created: string[];
  updated: string[];
}): ChangePreview[] {
  const { baseFiles, finalFiles, created, updated } = params;
  const baseMap = new Map(baseFiles.map((file) => [file.path, String(file.content ?? "")]));
  const finalMap = new Map(finalFiles.map((file) => [file.path, String(file.content ?? "")]));

  const previews: ChangePreview[] = [];

  for (const path of created) {
    const afterContent = finalMap.get(path) ?? "";
    const preview = snippetLines(afterContent, NEW_FILE_PREVIEW_CHARS);
    previews.push({
      path,
      kind: "new",
      preview: preview.text,
      afterSnippet: preview.text,
      truncated: preview.truncated,
    });
  }

  for (const path of updated) {
    const beforeContent = baseMap.get(path) ?? "";
    const afterContent = finalMap.get(path) ?? "";
    const diff = buildCompactDiff(beforeContent, afterContent);
    previews.push({
      path,
      kind: "updated",
      preview: diff.diffSnippet,
      beforeSnippet: diff.beforeSnippet,
      afterSnippet: diff.afterSnippet,
      diffSnippet: diff.diffSnippet,
      truncated: diff.truncated,
    });
  }

  return previews;
}
