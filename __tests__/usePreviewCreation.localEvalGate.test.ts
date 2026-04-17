describe("usePreviewCreation local eval env gate", () => {
  const originalEnv = { ...process.env };
  const runtimeGlobal = globalThis as typeof globalThis & { __DEV__?: boolean };
  const originalDev = runtimeGlobal.__DEV__;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_EVAL;
    delete process.env.EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_CDN;
    process.env.NODE_ENV = "development";
    runtimeGlobal.__DEV__ = true;
  });

  afterAll(() => {
    process.env = originalEnv;
    runtimeGlobal.__DEV__ = originalDev;
  });

  it("keeps CDN opt-in disabled unless the dedicated env flag is set", () => {
    process.env.EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_EVAL = "true";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      isExplicitUnsafeLocalPreviewEvalEnabled,
      isExplicitUnsafeLocalPreviewCdnEnabled,
    } = require("../hooks/usePreviewCreation");

    expect(isExplicitUnsafeLocalPreviewEvalEnabled()).toBe(true);
    expect(isExplicitUnsafeLocalPreviewCdnEnabled()).toBe(false);
  });

  it("enables eval and CDN only when both dedicated dev flags are set", () => {
    process.env.EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_EVAL = "true";
    process.env.EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_CDN = "true";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      isExplicitUnsafeLocalPreviewEvalEnabled,
      isExplicitUnsafeLocalPreviewCdnEnabled,
    } = require("../hooks/usePreviewCreation");

    expect(isExplicitUnsafeLocalPreviewEvalEnabled()).toBe(true);
    expect(isExplicitUnsafeLocalPreviewCdnEnabled()).toBe(true);
  });
});