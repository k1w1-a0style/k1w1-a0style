import type { ProjectData } from "../../shared/types/project";
// project/services/projectArchiveService.ts
// Zip import/export helpers extracted from ProjectContext.


import {
  exportProjectAsZipFile,
  importProjectFromZipFile,
} from "../../infra/storage/projectPersistence";
import type { ProjectFile } from "../../shared/types/project";

export type ZipExportResult = {
  fileCount: number;
  uri?: string;
};

export type ZipImportResult = {
  project: ProjectData;
  fileCount: number;
};

const BINARY_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "ico",
  "mp3",
  "wav",
  "m4a",
  "mp4",
  "mov",
  "mkv",
  "zip",
  "jar",
  "keystore",
  "jks",
  "cer",
  "der",
  "p12",
  "ttf",
  "otf",
  "woff",
  "woff2",
]);

function isBinaryPath(p: string): boolean {
  const n = String(p || "").toLowerCase();
  const ext = n.includes(".") ? n.split(".").pop() || "" : "";
  return BINARY_EXT.has(ext);
}

export function cloneProjectWithOnlyTextFiles(project: ProjectData): ProjectData {
  const filtered = (project.files || []).filter((f: ProjectFile) => {
    if (!f?.path || typeof f.path !== "string") return false;
    const content = typeof f.content === "string" ? f.content : "";
    if (content.startsWith("base64:")) return false;
    if (isBinaryPath(f.path)) return false;
    return true;
  });

  return {
    ...project,
    files: filtered,
  };
}

export async function exportProjectZip(project: ProjectData): Promise<ZipExportResult> {
  const res = await exportProjectAsZipFile(project);
  const maybePath = (res as { uri?: string; path?: string }).uri ?? (res as { path?: string }).path;
  return {
    fileCount: Number(res?.fileCount ?? 0),
    uri: maybePath ?? undefined,
  };
}

export async function exportTextFilesZip(project: ProjectData): Promise<ZipExportResult> {
  const clone = cloneProjectWithOnlyTextFiles(project);
  return exportProjectZip(clone);
}

export async function importProjectZip(): Promise<ZipImportResult> {
  const res = await importProjectFromZipFile();
  const project: ProjectData = res.project;

  // Reset chat after import (privacy + avoid merging incompatible chat schema)
  project.chatHistory = [];

  return {
    project,
    fileCount: Number(res?.fileCount ?? 0),
  };
}
