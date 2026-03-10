import { useCallback, useState } from "react";
import { Alert } from "react-native";

import {
  autoFixCIWorkflows,
  checkRepoSecrets,
  parseOwnerRepo,
} from "../../../lib/diagnostics/ciAutoFix";

export function useDiagnosticCiAutofix(opts: {
  linkedRepo: string;
  linkedBranch?: string;
}) {
  const { linkedRepo, linkedBranch } = opts;

  const [ciFixing, setCiFixing] = useState(false);
  const [ciFixLog, setCiFixLog] = useState<string | null>(null);

  const runCiAutofix = useCallback(async () => {
    const parsed = parseOwnerRepo(linkedRepo);
    if (!parsed) {
      Alert.alert(
        "CI/Workflows",
        "Kein gültiges GitHub Repo verknüpft (erwartet: owner/repo).",
      );
      return;
    }

    const branch = ((linkedBranch || "") as string).trim();
    if (!branch) {
      Alert.alert("CI-Autofix blockiert", "Kein Branch verknüpft.");
      return;
    }

    setCiFixing(true);
    setCiFixLog(null);
    try {
      const secrets = await checkRepoSecrets(parsed.owner, parsed.repo);
      const changes = await autoFixCIWorkflows({
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
      });

      const changedCount = changes.filter((c) => c.changed).length;
      const missing = secrets.missing;

      const summaryLines: string[] = [
        `Repo: ${parsed.owner}/${parsed.repo}`,
        `Branch: ${branch}`,
        `Workflow-Files aktualisiert: ${changedCount}/${changes.length}`,
        missing.length ? `❗ Fehlende Secrets: ${missing.join(", ")}` : `✅ Secrets: OK`,
        "",
        "Details:",
        ...changes.map((c) => `${c.changed ? "🛠️" : "✅"} ${c.path} — ${c.message}`),
      ];

      const summary = summaryLines.join("\n");
      setCiFixLog(summary);
      Alert.alert(
        "CI/Workflows",
        missing.length
          ? "Workflows gefixt. Es fehlen noch Secrets."
          : "Workflows sind gefixt & Secrets sehen gut aus.",
      );
    } catch (e: any) {
      setCiFixLog(String(e?.message || e));
      Alert.alert("CI/Workflows", "Fehler beim Fixen: " + String(e?.message || e));
    } finally {
      setCiFixing(false);
    }
  }, [linkedRepo, linkedBranch]);

  return { ciFixing, ciFixLog, runCiAutofix };
}
