import {
  isWizardRunInputReady,
  validateWizardRunInputs,
} from "../screens/CredentialsWizardScreen/hooks/credentialRunValidation";

describe("credentialRunValidation", () => {
  it("returns missing-input issue when required values are absent", () => {
    expect(
      validateWizardRunInputs({
        supabaseUrl: "",
        adminKey: "",
        repoFullName: "",
      }),
    ).toEqual({
      title: "Fehlt was",
      message: "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.",
    });
  });

  it("returns specific issues for invalid url/repo/key", () => {
    expect(
      validateWizardRunInputs({
        supabaseUrl: "http://local",
        adminKey: "edge-admin-key-abcdefghijklmnopqrstuvwxyz123456",
        repoFullName: "owner/repo",
      }),
    )?.toEqual(
      expect.objectContaining({ title: "Supabase URL ungültig" }),
    );

    expect(
      validateWizardRunInputs({
        supabaseUrl: "https://a.supabase.co",
        adminKey: "edge-admin-key-abcdefghijklmnopqrstuvwxyz123456",
        repoFullName: "owner",
      }),
    )?.toEqual(expect.objectContaining({ title: "Repo ungültig" }));

    expect(
      validateWizardRunInputs({
        supabaseUrl: "https://a.supabase.co",
        adminKey: "short",
        repoFullName: "owner/repo",
      }),
    )?.toEqual(expect.objectContaining({ title: "Admin-Key wirkt ungültig" }));
  });

  it("returns null for valid inputs", () => {
    expect(
      validateWizardRunInputs({
        supabaseUrl: "https://a.supabase.co",
        adminKey: "edge-admin-key-abcdefghijklmnopqrstuvwxyz123456",
        repoFullName: "owner/repo",
      }),
    ).toBeNull();
  });

  it("exposes readiness as a simple boolean", () => {
    expect(
      isWizardRunInputReady({
        supabaseUrl: "https://a.supabase.co",
        adminKey: "edge-admin-key-abcdefghijklmnopqrstuvwxyz123456",
        repoFullName: "owner/repo",
      }),
    ).toBe(true);

    expect(
      isWizardRunInputReady({
        supabaseUrl: "https://a.supabase.co",
        adminKey: "short",
        repoFullName: "owner/repo",
      }),
    ).toBe(false);
  });
});
