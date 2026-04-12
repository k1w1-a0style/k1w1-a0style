import { computeProjectFilesSignature } from "../../../lib/repoSyncOrchestration";
import type { ProjectFile } from "../../../shared/types/project";

export type PullApplyStrategy = "overwrite" | "skipConflicts" | "mirror";
export type PullApplyOutcome = "applied" | "noop" | "partial";

export type PullApplySemantics = {
  mergedFiles: ProjectFile[];
  outcome: PullApplyOutcome;
  localWriteRequired: boolean;
  shouldMarkSyncSignature: boolean;
  messageTitle: string;
  messageBody: string;
  summary: {
    remoteCount: number;
    conflictCount: number;
    remoteOnlyCount: number;
    unchangedCount: number;
    skippedConflictCount: number;
    localOnlyCount: number;
  };
};

export function shouldConfirmMirrorDelete(params: {
  strategy: PullApplyStrategy;
  semantics: PullApplySemantics;
}): boolean {
  return params.strategy === "mirror" && params.semantics.summary.localOnlyCount > 0;
}

export function resolvePullApplySemantics(params: {
  localFiles: ProjectFile[];
  remoteFiles: ProjectFile[];
  strategy: PullApplyStrategy;
}): PullApplySemantics {
  const localFiles = Array.isArray(params.localFiles) ? params.localFiles : [];
  const remoteFiles = Array.isArray(params.remoteFiles) ? params.remoteFiles : [];
  const strategy = params.strategy;

  const localMap = new Map<string, ProjectFile>();
  for (const file of localFiles) {
    const path = String(file?.path ?? "").trim();
    if (!path) continue;
    localMap.set(path, { path, content: String(file?.content ?? "") });
  }

  const remoteMap = new Map<string, ProjectFile>();
  let conflictCount = 0;
  let remoteOnlyCount = 0;
  let unchangedCount = 0;
  let localOnlyCount = 0;

  for (const file of remoteFiles) {
    const path = String(file?.path ?? "").trim();
    if (!path) continue;
    const normalizedRemote = { path, content: String(file?.content ?? "") };
    remoteMap.set(path, normalizedRemote);

    const localFile = localMap.get(path);
    if (!localFile) {
      remoteOnlyCount += 1;
      continue;
    }
    if (localFile.content === normalizedRemote.content) {
      unchangedCount += 1;
      continue;
    }
    conflictCount += 1;
  }

  const mergedFiles: ProjectFile[] = [];
  for (const [path, localFile] of localMap.entries()) {
    const missingRemote = !remoteMap.has(path);
    if (missingRemote) localOnlyCount += 1;
    if (!missingRemote || strategy !== "mirror") {
      if (missingRemote) mergedFiles.push(localFile);
    }
  }
  for (const [path, remoteFile] of remoteMap.entries()) {
    const localFile = localMap.get(path);
    const isConflict = !!localFile && localFile.content !== remoteFile.content;
    if (strategy === "skipConflicts" && isConflict && localFile) {
      mergedFiles.push(localFile);
    } else {
      mergedFiles.push(remoteFile);
    }
  }

  const localBeforeSig = computeProjectFilesSignature(localFiles);
  const localAfterSig = computeProjectFilesSignature(mergedFiles);
  const localWriteRequired = localBeforeSig !== localAfterSig;
  const skippedConflictCount = strategy === "skipConflicts" ? conflictCount : 0;
  const partial = skippedConflictCount > 0;

  if (partial) {
    return {
      mergedFiles,
      outcome: "partial",
      localWriteRequired,
      shouldMarkSyncSignature: false,
      messageTitle: "⚠️ Pull teilweise angewendet",
      messageBody: localWriteRequired
        ? "Remote-Änderungen ohne Konflikt wurden übernommen. Konflikte blieben lokal unverändert und der Sync bleibt absichtlich nicht als vollständig markiert."
        : "Es wurden nur Konflikte erkannt und übersprungen. Lokal wurde nichts geändert; der Repo-Stand gilt weiterhin nicht als vollständig synchronisiert.",
      summary: {
        remoteCount: remoteMap.size,
        conflictCount,
        remoteOnlyCount,
        unchangedCount,
        skippedConflictCount,
        localOnlyCount,
      },
    };
  }

  if (!localWriteRequired) {
    return {
      mergedFiles,
      outcome: "noop",
      localWriteRequired: false,
      shouldMarkSyncSignature: true,
      messageTitle: "ℹ️ Pull ohne Änderungen",
      messageBody: "Der Remote-Stand war bereits lokal vorhanden. Es wurde nichts geschrieben und der Sync bleibt unverändert aktuell.",
      summary: {
        remoteCount: remoteMap.size,
        conflictCount,
        remoteOnlyCount,
        unchangedCount,
        skippedConflictCount,
        localOnlyCount,
      },
    };
  }

  if (strategy === "mirror") {
    return {
      mergedFiles,
      outcome: "applied",
      localWriteRequired,
      shouldMarkSyncSignature: true,
      messageTitle: "✅ Full Sync angewendet",
      messageBody:
        localOnlyCount > 0
          ? "Der lokale Stand wurde vollständig auf den Remote-Stand gespiegelt (inkl. expliziter Löschungen lokaler-only Dateien)."
          : "Der lokale Stand wurde vollständig auf den Remote-Stand gespiegelt.",
      summary: {
        remoteCount: remoteMap.size,
        conflictCount,
        remoteOnlyCount,
        unchangedCount,
        skippedConflictCount,
        localOnlyCount,
      },
    };
  }

  return {
    mergedFiles,
    outcome: "applied",
    localWriteRequired: true,
    shouldMarkSyncSignature: true,
    messageTitle: "✅ Pull angewendet",
    messageBody:
      strategy === "overwrite"
        ? "Remote-Änderungen wurden lokal übernommen. Konflikte wurden durch die Remote-Version ersetzt."
        : "Remote-Änderungen ohne Konflikt wurden lokal übernommen.",
    summary: {
      remoteCount: remoteMap.size,
      conflictCount,
      remoteOnlyCount,
      unchangedCount,
      skippedConflictCount,
      localOnlyCount,
    },
  };
}

export async function executePullApply(params: {
  localFiles: ProjectFile[];
  remoteFiles: ProjectFile[];
  strategy: PullApplyStrategy;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
  markSyncSignature: (files: ProjectFile[]) => Promise<void>;
  refreshSyncStatus: () => Promise<void>;
  confirmMirrorDelete?: (semantics: PullApplySemantics) => Promise<boolean>;
}): Promise<PullApplySemantics> {
  const semantics = resolvePullApplySemantics({
    localFiles: params.localFiles,
    remoteFiles: params.remoteFiles,
    strategy: params.strategy,
  });

  if (shouldConfirmMirrorDelete({ strategy: params.strategy, semantics })) {
    const confirmed = await (params.confirmMirrorDelete?.(semantics) ?? Promise.resolve(false));
    if (!confirmed) {
      throw new Error("Mirror apply canceled by user.");
    }
  }

  if (semantics.localWriteRequired) {
    await params.updateProjectFiles(semantics.mergedFiles);
  }

  if (semantics.shouldMarkSyncSignature) {
    await params.markSyncSignature(semantics.mergedFiles);
  }

  if (semantics.localWriteRequired || semantics.shouldMarkSyncSignature) {
    await params.refreshSyncStatus();
  }

  return semantics;
}
