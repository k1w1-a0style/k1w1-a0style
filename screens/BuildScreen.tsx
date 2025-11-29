import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from "react-native";
import { useBuildStatus } from "../hooks/useBuildStatus";
import { CONFIG } from "../config";
import { theme } from "../theme";

export default function BuildScreen() {
  const [jobId, setJobId] = useState<number | null>(null);
  const { status, details } = useBuildStatus(jobId);

  const startBuild = async () => {
    try {
      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/trigger-eas-build`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            githubRepo: CONFIG.BUILD.GITHUB_REPO,
          }),
        }
      );

      const json = await res.json();

      if (json.ok && json.job?.id) {
        setJobId(json.job.id);
      } else {
        console.log("[BuildScreen] Unexpected trigger response:", json);
        alert("Fehler beim Start des Builds");
      }
    } catch (e) {
      console.log("[BuildScreen] Build-Start-Error:", e);
      alert("Build konnte nicht gestartet werden");
    }
  };

  const openUrl = (url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch((e) => {
      console.log("[BuildScreen] Linking-Error:", e);
      alert("Link konnte nicht geöffnet werden");
    });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>📦 EAS Build Status</Text>

      <TouchableOpacity onPress={startBuild} style={styles.buildButton}>
        <Text style={styles.buildButtonText}>🚀 Build starten</Text>
      </TouchableOpacity>

      {!jobId && (
        <Text style={styles.hintText}>
          Noch kein Build gestartet. Starte oben einen neuen Build.
        </Text>
      )}

      {jobId && (
        <View style={styles.statusBox}>
          <Text style={styles.label}>Job ID:</Text>
          <Text style={styles.jobId}>{jobId}</Text>

          <View style={styles.statusRow}>
            <Text style={styles.label}>Status:</Text>

            {status === "queued" && (
              <Text style={styles.statusQueued}>⏳ Warteschlange…</Text>
            )}

            {status === "building" && (
              <Text style={styles.statusBuilding}>🔧 Build läuft…</Text>
            )}

            {status === "success" && (
              <Text style={styles.statusSuccess}>✅ Build erfolgreich!</Text>
            )}

            {status === "failed" && (
              <Text style={styles.statusFailed}>❌ Build fehlgeschlagen!</Text>
            )}

            {status === "idle" && (
              <Text style={styles.statusIdle}>Noch kein Build gestartet</Text>
            )}

            {status === "error" && (
              <Text style={styles.statusFailed}>❌ Fehler beim Abruf</Text>
            )}
          </View>

          {(status === "queued" || status === "building") && (
            <ActivityIndicator
              size="small"
              color={theme.palette.primary}
              style={{ marginTop: 10 }}
            />
          )}

          {details?.urls?.html && (
            <TouchableOpacity
              onPress={() => openUrl(details?.urls?.html)}
              style={styles.linkButton}
            >
              <Text style={styles.linkButtonText}>
                🔗 GitHub Build öffnen
              </Text>
            </TouchableOpacity>
          )}

          {details?.urls?.artifacts && (
            <TouchableOpacity
              onPress={() => openUrl(details?.urls?.artifacts)}
              style={styles.linkButton}
            >
              <Text style={styles.linkButtonText}>
                ⬇️ Artefakte herunterladen
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: (theme as any).layout?.screenPadding ?? 16,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  buildButton: {
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  buildButtonText: {
    color: theme.palette.secondary,
    textAlign: "center",
    fontWeight: "bold",
  },
  hintText: {
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  statusBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 14,
  },
  jobId: {
    color: theme.palette.text.primary,
    fontSize: 16,
    marginBottom: 8,
  },
  statusRow: {
    marginTop: 4,
  },
  statusQueued: {
    color: theme.palette.warning,
  },
  statusBuilding: {
    color: "#29b6f6",
  },
  statusSuccess: {
    color: theme.palette.success,
  },
  statusFailed: {
    color: theme.palette.error,
  },
  statusIdle: {
    color: theme.palette.text.secondary,
  },
  linkButton: {
    marginTop: 12,
    backgroundColor: theme.palette.secondary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  linkButtonText: {
    color: theme.palette.text.primary,
  },
});
