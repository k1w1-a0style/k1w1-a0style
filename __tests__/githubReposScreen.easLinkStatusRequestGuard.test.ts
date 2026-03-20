import {
  createEasLinkStatusRequestGuard,
  type EasLinkStatusRequestToken,
} from "../screens/GitHubReposScreen/utils/easLinkStatusRequestGuard";

describe("EAS link status request guard", () => {
  const token = (requestId: number, contextKey: string | null): EasLinkStatusRequestToken => ({
    requestId,
    contextKey,
  });

  it("rejects a stale request after the repo/branch context changes", () => {
    const guard = createEasLinkStatusRequestGuard("owner/repo-a@@main");
    const stale = guard.begin();

    guard.setContextKey("owner/repo-b@@release");

    expect(guard.isCurrent(stale)).toBe(false);
  });

  it("lets the newer request win over an older slower one in the same context", () => {
    const guard = createEasLinkStatusRequestGuard("owner/repo-a@@main");
    const older = guard.begin();
    const newer = guard.begin();

    expect(guard.isCurrent(older)).toBe(false);
    expect(guard.isCurrent(newer)).toBe(true);
  });

  it("invalidates older in-flight checks before a write to recheck flow starts", () => {
    const guard = createEasLinkStatusRequestGuard("owner/repo-a@@main");
    const oldCheck = guard.begin();
    const write = guard.begin();
    const recheck = guard.begin();

    expect(guard.isCurrent(oldCheck)).toBe(false);
    expect(guard.isCurrent(write)).toBe(false);
    expect(guard.isCurrent(recheck)).toBe(true);
  });

  it("keeps the current request valid while repo/branch stay unchanged", () => {
    const guard = createEasLinkStatusRequestGuard("owner/repo-a@@main");
    const current = guard.begin();

    expect(guard.isCurrent(current)).toBe(true);
  });

  it("treats missing context keys as non-committable neutral state", () => {
    const guard = createEasLinkStatusRequestGuard(null);
    const current = guard.begin();

    expect(current).toEqual(token(1, null));
    expect(guard.isCurrent(current)).toBe(false);
  });
});
