import { mergePersistedStatusByMode } from "../screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen";

describe("credentials wizard persisted status hydration", () => {
  it("returns only persisted values plus explicit null defaults", () => {
    expect(
      mergePersistedStatusByMode({
        preview: { exists: true },
      }),
    ).toEqual({
      dev: null,
      preview: { exists: true },
      production: null,
    });
  });

  it("does not carry stale status from a previous project scope", () => {
    const stale = {
      dev: { exists: true },
      preview: { exists: false },
      production: { exists: true },
    };

    const nextHydration = mergePersistedStatusByMode({
      production: { exists: false },
    });

    expect(nextHydration).not.toEqual(stale);
    expect(nextHydration).toEqual({
      dev: null,
      preview: null,
      production: { exists: false },
    });
  });
});
