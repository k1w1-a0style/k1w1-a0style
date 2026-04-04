import {
  getEmptyStatusByMode,
  hydratePersistedStatusByMode,
  persistWizardStatusByMode,
} from "../screens/CredentialsWizardScreen/hooks/wizardStatusStore";

const mockGetItem = jest.fn<Promise<string | null>, [string]>(async (_key: string) => null);
const mockSetItem = jest.fn<Promise<void>, [string, string]>(async (_key: string, _value: string) => undefined);
const mockRemoveItem = jest.fn<Promise<void>, [string]>(async (_key: string) => undefined);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
    removeItem: (key: string) => mockRemoveItem(key),
  },
}));

describe("credentials wizard status store helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates scoped values and falls back to legacy keys when scoped keys are empty", async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "cred_key_exists_dev::project%3Arepo") return null;
      if (key === "cred_key_exists_dev") return "true";
      if (key === "cred_key_exists_dev_state::project%3Arepo") return null;
      if (key === "cred_key_exists_dev_state") return "verified";
      if (key === "cred_key_exists_dev_detail::project%3Arepo") return null;
      if (key === "cred_key_exists_dev_detail") return "legacy detail";
      return null;
    });

    const hydrated = await hydratePersistedStatusByMode("project:repo");
    expect(hydrated.dev).toEqual({
      exists: true,
      credentialState: "verified",
      stateDetail: "legacy detail",
    });
    expect(hydrated.preview).toBeNull();
    expect(hydrated.production).toBeNull();
  });

  it("ignores unrecognized persisted states but keeps exists/detail", async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "cred_key_exists_preview::scope-1") return "false";
      if (key === "cred_key_exists_preview_state::scope-1") return "not-a-state";
      if (key === "cred_key_exists_preview_detail::scope-1") return "detail";
      return null;
    });

    const hydrated = await hydratePersistedStatusByMode("scope-1");
    expect(hydrated.preview).toEqual({
      exists: false,
      credentialState: undefined,
      stateDetail: "detail",
    });
  });

  it("persists exists/state/detail and clears metadata when status is null", async () => {
    await persistWizardStatusByMode({
      mode: "production",
      projectScope: "scope-2",
      status: {
        exists: true,
        credentialState: "verified",
        stateDetail: "ok",
      },
    });

    expect(mockSetItem).toHaveBeenCalledWith("cred_key_exists_production::scope-2", "true");
    expect(mockSetItem).toHaveBeenCalledWith("cred_key_exists_production_state::scope-2", "verified");
    expect(mockSetItem).toHaveBeenCalledWith("cred_key_exists_production_detail::scope-2", "ok");

    jest.clearAllMocks();

    await persistWizardStatusByMode({
      mode: "production",
      projectScope: "scope-2",
      status: null,
    });

    expect(mockSetItem).toHaveBeenCalledWith("cred_key_exists_production::scope-2", "false");
    expect(mockRemoveItem).toHaveBeenCalledWith("cred_key_exists_production_state::scope-2");
    expect(mockRemoveItem).toHaveBeenCalledWith("cred_key_exists_production_detail::scope-2");
  });

  it("exposes explicit null defaults for all modes", () => {
    expect(getEmptyStatusByMode()).toEqual({
      dev: null,
      preview: null,
      production: null,
    });
  });
});
