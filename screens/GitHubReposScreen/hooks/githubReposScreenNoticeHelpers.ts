import type { EasLinkPresentation } from "../utils/easLinkContract";

type AlertNotice = {
  title: string;
  message: string;
};

export function getSecretsSyncNotice(updatedSecrets: string[]): AlertNotice {
  if (!updatedSecrets.length) {
    return {
      title: "ℹ️ Secrets",
      message: "Keine Secrets zum Synchronisieren gefunden.",
    };
  }

  return {
    title: "✅ Secrets synchronisiert",
    message: updatedSecrets.join(", "),
  };
}

export function getEasLinkWriteNotice(writeOutcome: EasLinkPresentation): AlertNotice {
  if (writeOutcome.state === "verified") {
    return {
      title: "✅ EAS verifiziert",
      message: "Projektdatei geschrieben und Repo-Link sauber bestaetigt.",
    };
  }

  if (writeOutcome.state === "pending_recheck") {
    return {
      title: "ℹ️ EAS geschrieben",
      message: writeOutcome.detail,
    };
  }

  return {
    title: "⚠️ EAS geschrieben, aber nicht verifiziert",
    message: writeOutcome.detail,
  };
}
