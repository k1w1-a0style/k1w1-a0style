import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

type RecoverableJournalEnvelope<TSnapshot> = {
  version: 1;
  flow: string;
  createdAt: string;
  stage: "applying" | "rollback_failed";
  snapshot: TSnapshot;
  errorMessage?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return String(error);
}

async function writeJournal<TSnapshot>(journalKey: string, payload: RecoverableJournalEnvelope<TSnapshot>): Promise<void> {
  await AsyncStorage.setItem(journalKey, JSON.stringify(payload));
}

async function clearJournal(journalKey: string): Promise<void> {
  await AsyncStorage.removeItem(journalKey);
}

export type RecoverableCommitFailure = {
  commitError: unknown;
  rollbackError?: unknown;
};

export class RecoverableCommitError extends Error {
  readonly flow: string;
  readonly rollbackFailed: boolean;
  readonly causeInfo: RecoverableCommitFailure;

  constructor(params: {
    flow: string;
    rollbackFailed: boolean;
    commitError: unknown;
    rollbackError?: unknown;
  }) {
    const prefix = params.rollbackFailed
      ? "Commit fehlgeschlagen und Rollback konnte nicht vollständig abgeschlossen werden."
      : "Commit fehlgeschlagen, Änderungen wurden zurückgerollt.";
    super(prefix);
    this.name = "RecoverableCommitError";
    this.flow = params.flow;
    this.rollbackFailed = params.rollbackFailed;
    this.causeInfo = {
      commitError: params.commitError,
      rollbackError: params.rollbackError,
    };
  }
}

export async function recoverFromPendingJournal<TSnapshot>(params: {
  journalKey: string;
  flow: string;
  restoreSnapshot: (snapshot: TSnapshot) => Promise<void>;
}): Promise<void> {
  const raw = await AsyncStorage.getItem(params.journalKey);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as RecoverableJournalEnvelope<TSnapshot>;
    if (parsed?.version !== 1 || parsed.flow !== params.flow) {
      await clearJournal(params.journalKey);
      return;
    }
    await params.restoreSnapshot(parsed.snapshot);
    await clearJournal(params.journalKey);
  } catch (error) {
    logger.error("[recoverable-commit] Journal-Recovery fehlgeschlagen", {
      flow: params.flow,
      journalKey: params.journalKey,
      error,
    });
    throw error;
  }
}

export async function runRecoverableCommit<TSnapshot, TJournalSnapshot = TSnapshot>(params: {
  journalKey: string;
  flow: string;
  snapshot: TSnapshot;
  journalSnapshot?: TJournalSnapshot;
  apply: () => Promise<void>;
  rollback: (snapshot: TSnapshot) => Promise<void>;
}): Promise<void> {
  await writeJournal(params.journalKey, {
    version: 1,
    flow: params.flow,
    createdAt: new Date().toISOString(),
    stage: "applying",
    snapshot: params.journalSnapshot ?? params.snapshot,
  });

  try {
    await params.apply();
    await clearJournal(params.journalKey);
  } catch (commitError) {
    let rollbackError: unknown = null;
    try {
      await params.rollback(params.snapshot);
      await clearJournal(params.journalKey);
    } catch (error) {
      rollbackError = error;
      await writeJournal(params.journalKey, {
        version: 1,
        flow: params.flow,
        createdAt: new Date().toISOString(),
        stage: "rollback_failed",
        snapshot: params.journalSnapshot ?? params.snapshot,
        errorMessage: `${getErrorMessage(commitError)} | rollback: ${getErrorMessage(error)}`,
      });
    }
    if (rollbackError) {
      throw new RecoverableCommitError({
        flow: params.flow,
        rollbackFailed: true,
        commitError,
        rollbackError,
      });
    }
    throw new RecoverableCommitError({
      flow: params.flow,
      rollbackFailed: false,
      commitError,
    });
  }
}
