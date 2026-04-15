import AsyncStorage from "@react-native-async-storage/async-storage";
import { recoverFromPendingJournal, runRecoverableCommit } from "../recoverableCommit";

describe("recoverableCommit", () => {
  const journalKey = "test_recoverable_commit_journal";

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("clears journal after successful commit", async () => {
    await runRecoverableCommit({
      journalKey,
      flow: "test-flow",
      snapshot: { before: "value" },
      apply: async () => {
        await AsyncStorage.setItem("result", "next");
      },
      rollback: async () => {
        throw new Error("rollback should not run");
      },
    });

    expect(await AsyncStorage.getItem("result")).toBe("next");
    expect(await AsyncStorage.getItem(journalKey)).toBeNull();
  });

  it("restores snapshot when a prior journal exists", async () => {
    await AsyncStorage.setItem(
      journalKey,
      JSON.stringify({
        version: 1,
        flow: "test-flow",
        createdAt: "2026-04-15T00:00:00.000Z",
        stage: "rollback_failed",
        snapshot: { restored: "ok" },
      }),
    );

    await recoverFromPendingJournal({
      journalKey,
      flow: "test-flow",
      restoreSnapshot: async (snapshot: { restored: string }) => {
        await AsyncStorage.setItem("restored", snapshot.restored);
      },
    });

    expect(await AsyncStorage.getItem("restored")).toBe("ok");
    expect(await AsyncStorage.getItem(journalKey)).toBeNull();
  });

  it("classifies commit-failure + successful rollback as rollbackFailed=false", async () => {
    await expect(
      runRecoverableCommit({
        journalKey,
        flow: "test-flow",
        snapshot: { before: "value" },
        apply: async () => {
          throw new Error("commit boom");
        },
        rollback: async () => {
          await AsyncStorage.setItem("rolledBack", "yes");
        },
      }),
    ).rejects.toMatchObject({
      name: "RecoverableCommitError",
      rollbackFailed: false,
    });

    expect(await AsyncStorage.getItem("rolledBack")).toBe("yes");
    expect(await AsyncStorage.getItem(journalKey)).toBeNull();
  });

  it("classifies real rollback failures as rollbackFailed=true and keeps rollback_failed journal", async () => {
    await expect(
      runRecoverableCommit({
        journalKey,
        flow: "test-flow",
        snapshot: { before: "value" },
        apply: async () => {
          throw new Error("commit boom");
        },
        rollback: async () => {
          throw new Error("rollback boom");
        },
      }),
    ).rejects.toMatchObject({
      name: "RecoverableCommitError",
      rollbackFailed: true,
    });

    const raw = await AsyncStorage.getItem(journalKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(String(raw)) as { stage?: string };
    expect(parsed.stage).toBe("rollback_failed");
  });
});
