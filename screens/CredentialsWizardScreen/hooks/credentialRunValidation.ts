import { isLikelyValidAdminKey } from "../../../lib/security/isLikelyValidAdminKey";
import {
  isLikelyValidRepoFullName,
  isLikelyValidSupabaseUrl,
} from "../utils/security";

export type WizardRunValidationIssue = {
  title: string;
  message: string;
};

export const validateWizardRunInputs = (params: {
  supabaseUrl: string;
  adminKey: string;
  repoFullName: string;
}): WizardRunValidationIssue | null => {
  const url = (params.supabaseUrl || "").trim();
  const key = (params.adminKey || "").trim();
  const repo = (params.repoFullName || "").trim();

  if (!url || !key || !repo) {
    return {
      title: "Fehlt was",
      message: "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.",
    };
  }

  if (!isLikelyValidSupabaseUrl(url)) {
    return {
      title: "Supabase URL ungültig",
      message:
        "Bitte eine HTTPS URL angeben (z.B. https://<project>.supabase.co) und keine Leerzeichen.",
    };
  }

  if (!isLikelyValidRepoFullName(repo)) {
    return {
      title: "Repo ungültig",
      message:
        "Repo muss im Format owner/repo sein (z.B. k1w1-a0style/k1w1-a0style).",
    };
  }

  if (!isLikelyValidAdminKey(key)) {
    return {
      title: "Admin-Key wirkt ungültig",
      message: "Admin-Key ist zu kurz oder enthält Leerzeichen.",
    };
  }

  return null;
};
