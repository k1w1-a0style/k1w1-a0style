import { logger } from "../lib/logger";
import { runCleanupTask, runWithCleanupFallback } from "../lib/safeCleanup";

describe("safeCleanup helpers", () => {
  it("returns fallback and logs warn when runWithCleanupFallback fails", async () => {
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const result = await runWithCleanupFallback(
      async () => {
        throw new Error("boom");
      },
      "fallback-value",
      "[safeCleanup-test] fallback",
    );
    expect(result).toBe("fallback-value");
    expect(warnSpy).toHaveBeenCalledWith("[safeCleanup-test] fallback", expect.any(Object));
    warnSpy.mockRestore();
  });

  it("does not throw when cleanup task fails", async () => {
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    await expect(
      runCleanupTask(
        async () => {
          throw new Error("cleanup-failed");
        },
        "[safeCleanup-test] task",
      ),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("[safeCleanup-test] task", expect.any(Object));
    warnSpy.mockRestore();
  });
});
