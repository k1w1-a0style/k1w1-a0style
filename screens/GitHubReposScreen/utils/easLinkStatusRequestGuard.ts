export type EasLinkStatusRequestToken = {
  requestId: number;
  contextKey: string | null;
};

export function createEasLinkStatusRequestGuard(initialContextKey: string | null = null) {
  let currentContextKey = initialContextKey;
  let currentRequestId = 0;

  return {
    getCurrentRequestId(): number {
      return currentRequestId;
    },

    setContextKey(nextContextKey: string | null): number {
      currentContextKey = nextContextKey;
      currentRequestId += 1;
      return currentRequestId;
    },

    invalidate(): number {
      currentRequestId += 1;
      return currentRequestId;
    },

    begin(contextKey = currentContextKey): EasLinkStatusRequestToken {
      currentRequestId += 1;
      return {
        requestId: currentRequestId,
        contextKey,
      };
    },

    isCurrent(token: EasLinkStatusRequestToken): boolean {
      if (!token.contextKey) return false;
      return token.requestId === currentRequestId && token.contextKey === currentContextKey;
    },
  };
}
