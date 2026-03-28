import {
  getEasLinkWriteNotice,
  getRepoSuccessNotice,
  getSecretsSyncNotice,
} from "../screens/GitHubReposScreen/hooks/githubReposScreenNoticeHelpers";
import { getEasLinkPresentation } from "../screens/GitHubReposScreen/utils/easLinkContract";

describe("githubReposScreenNoticeHelpers", () => {
  it("maps repo success actions to stable notice texts", () => {
    expect(getRepoSuccessNotice("repo_created", "owner/new-repo")).toEqual({
      title: "✅ Repo erstellt",
      message: "owner/new-repo",
    });
    expect(getRepoSuccessNotice("repo_renamed", "owner/new-name")).toEqual({
      title: "✅ Repo umbenannt",
      message: "owner/new-name",
    });
    expect(getRepoSuccessNotice("repo_deleted", "owner/deleted")).toEqual({
      title: "✅ Repo gelöscht",
      message: "owner/deleted",
    });
    expect(getRepoSuccessNotice("branch_deleted", "feature/a")).toEqual({
      title: "✅ Branch gelöscht",
      message: "feature/a",
    });
  });

  it("maps empty secrets sync results to neutral notice text", () => {
    expect(getSecretsSyncNotice([])).toEqual({
      title: "ℹ️ Secrets",
      message: "Keine Secrets zum Synchronisieren gefunden.",
    });
  });

  it("maps updated secrets to success notice text", () => {
    expect(getSecretsSyncNotice(["EXPO_TOKEN", "SUPABASE_URL"])).toEqual({
      title: "✅ Secrets synchronisiert",
      message: "EXPO_TOKEN, SUPABASE_URL",
    });
  });

  it("maps verified EAS write outcome to success text", () => {
    const verified = getEasLinkPresentation("verified", "ignored by notice mapping");
    expect(getEasLinkWriteNotice(verified)).toEqual({
      title: "✅ EAS verifiziert",
      message: "Projektdatei geschrieben und Repo-Link sauber bestaetigt.",
    });
  });

  it("maps pending recheck outcome to info text with detail passthrough", () => {
    const pending = getEasLinkPresentation("pending_recheck", "Bitte Re-Check");
    expect(getEasLinkWriteNotice(pending)).toEqual({
      title: "ℹ️ EAS geschrieben",
      message: "Bitte Re-Check",
    });
  });

  it("maps non-verified outcomes to warning text with detail passthrough", () => {
    const mismatch = getEasLinkPresentation("project_mismatch", "Andere ID gefunden");
    expect(getEasLinkWriteNotice(mismatch)).toEqual({
      title: "⚠️ EAS geschrieben, aber nicht verifiziert",
      message: "Andere ID gefunden",
    });
  });
});
