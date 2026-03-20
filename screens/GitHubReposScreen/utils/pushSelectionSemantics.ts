import type { ProjectFile } from "../../../shared/types/project";

export type PushPreparationResult =
  | {
      ok: true;
      branch: string;
      selectedFiles: ProjectFile[];
    }
  | {
      ok: false;
      title: string;
      message: string;
    };

export function resolvePushPreparation(params: {
  activeBranch?: string | null;
  pushSelectedPaths: Record<string, boolean>;
  localFiles: ProjectFile[];
}): PushPreparationResult {
  const selectedPaths = Object.entries(params.pushSelectedPaths)
    .filter(([, selected]) => !!selected)
    .map(([path]) => path);

  if (!selectedPaths.length) {
    return {
      ok: false,
      title: "⚠️",
      message: "Keine Dateien ausgewählt.",
    };
  }

  const selectedFiles = (Array.isArray(params.localFiles) ? params.localFiles : [])
    .filter((file) => selectedPaths.includes(file.path))
    .map((file) => ({ path: file.path, content: file.content }));

  if (!selectedFiles.length) {
    return {
      ok: false,
      title: "⚠️ Push",
      message: "Die aktuelle Auswahl enthält keine lokalen Dateien.",
    };
  }

  const branch = String(params.activeBranch ?? "").trim();
  if (!branch) {
    return {
      ok: false,
      title: "⚠️ Push",
      message: "Kein Branch ausgewählt.",
    };
  }

  return {
    ok: true,
    branch,
    selectedFiles,
  };
}
