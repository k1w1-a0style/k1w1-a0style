import {
  createEasLinkStatusRequestGuard,
  type EasLinkStatusRequestToken,
} from "../screens/GitHubReposScreen/utils/easLinkStatusRequestGuard";

type ModelState = {
  contextKey: string | null;
  requestId: number;
};

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1103515245 + 12345) >>> 0;
    return value / 0x100000000;
  };
}

function chooseContext(rand: () => number): string | null {
  const pool: Array<string | null> = [
    "owner/repo-a@@main",
    "owner/repo-a@@release",
    "owner/repo-b@@main",
    null,
  ];
  return pool[Math.floor(rand() * pool.length)] ?? null;
}

describe("EAS link status request guard stress", () => {
  it("keeps request-id/model semantics stable under mixed begin/invalidate/context changes", () => {
    const initial = "owner/repo-a@@main";
    const guard = createEasLinkStatusRequestGuard(initial);
    const rand = createSeededRandom(20260402);

    const model: ModelState = { contextKey: initial, requestId: 0 };
    const tokens: EasLinkStatusRequestToken[] = [];

    for (let i = 0; i < 200; i += 1) {
      const roll = rand();

      if (roll < 0.34) {
        const nextContext = chooseContext(rand);
        const returned = guard.setContextKey(nextContext);
        model.contextKey = nextContext;
        model.requestId += 1;
        expect(returned).toBe(model.requestId);
      } else if (roll < 0.67) {
        const returned = guard.invalidate();
        model.requestId += 1;
        expect(returned).toBe(model.requestId);
      } else {
        const token = guard.begin();
        model.requestId += 1;
        const expectedContext = model.contextKey;
        expect(token).toEqual({ requestId: model.requestId, contextKey: expectedContext });
        tokens.push(token);
      }

      expect(guard.getCurrentRequestId()).toBe(model.requestId);
    }

    for (const token of tokens) {
      const isExpectedCurrent =
        token.requestId === model.requestId &&
        token.contextKey !== null &&
        token.contextKey === model.contextKey;
      expect(guard.isCurrent(token)).toBe(isExpectedCurrent);
    }
  });
});
