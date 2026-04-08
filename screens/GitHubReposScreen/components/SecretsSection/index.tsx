import React, { useMemo } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { resolveRepoSecretVerification } from "../../../../lib/status/repoSecretVerification";
import { theme } from "../../../../theme";
import { styles } from "../../styles";
import { RuntimeCredentialsCard } from "./RuntimeCredentialsCard";
import { SecretsChecklist } from "./SecretsChecklist";
import { SecretsSummaryCard } from "./SecretsSummaryCard";
import {
  RuntimeCredentialRow,
  RuntimeSummaryPresentation,
  SummaryPresentation,
} from "./secretsSectionContracts";
import { useRepoSecretsVerification } from "./useRepoSecretsVerification";
import { useRuntimeCredentialPresence } from "./useRuntimeCredentialPresence";

export function SecretsSection(props: {
  activeRepo: string | null;
  onSyncSecrets?: () => void;
  syncing?: boolean;
}) {
  const { activeRepo, onSyncSecrets, syncing } = props;
  const { parsed, loading, error, names, stale, load, listContract, requiredStatus, optionalStatus } =
    useRepoSecretsVerification(activeRepo);
  const { runtimePresence, runtimeLoading } = useRuntimeCredentialPresence(activeRepo);

  const requiredMissing = useMemo(
    () => requiredStatus.some((entry) => entry.contract.isHardMissing),
    [requiredStatus],
  );

  const summary = useMemo<SummaryPresentation>(() => {
    if (listContract.state === "verified" && !requiredMissing) {
      return {
        icon: "checkmark-circle",
        color: theme.palette.primary,
        title: "Secret-Namen bestätigt",
        body: "GitHub hat die aktuelle Repo-Secret-Namensliste bestätigt. Die Pflicht-Secrets sind vorhanden.",
      };
    }

    if (listContract.state === "verified") {
      return {
        icon: "alert-circle",
        color: theme.palette.error,
        title: "Bestätigt, aber unvollständig",
        body: "GitHub hat die Repo-Secret-Namensliste bestätigt, aber mindestens ein Pflicht-Secret fehlt.",
      };
    }

    if (listContract.state === "auth_error") {
      return {
        icon: "lock-closed",
        color: theme.palette.warning,
        title: "Zugriff auf Repo-Secrets blockiert",
        body: "Die Secret-Namen konnten mit diesem GitHub-Zugriff nicht verifiziert werden. Das ist kein sicher bestätigtes 'fehlt'.",
      };
    }

    if (listContract.state === "stale") {
      return {
        icon: "time",
        color: theme.palette.warning,
        title: "Zuletzt bestätigte Secret-Namen sind veraltet",
        body: "Die zuletzt bestätigte Namensliste ist noch sichtbar, aber der aktuelle Recheck ist fehlgeschlagen. Bitte erneut prüfen.",
      };
    }

    return {
      icon: "help-circle",
      color: theme.palette.text.secondary,
      title: "Repo-Secret-Prüfung aktuell unklar",
      body: "Die Secret-Namen konnten aktuell nicht sicher geladen werden. Fehlend wird erst nach bestätigter Namensliste angezeigt.",
    };
  }, [listContract.state, requiredMissing]);

  const runtimeRows = useMemo<RuntimeCredentialRow[]>(() => {
    const expoRepoContract = requiredStatus.find((entry) => entry.name === "EXPO_TOKEN")?.contract;
    const workflowRepoContract = optionalStatus.find(
      (entry) => entry.name === "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
    )?.contract;
    const keystoreRepoContract = optionalStatus.find(
      (entry) => entry.name === "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
    )?.contract;

    return [
      {
        id: "expo",
        title: "EXPO_TOKEN",
        repoContract:
          expoRepoContract ??
          resolveRepoSecretVerification({
            name: "EXPO_TOKEN",
            names,
            error,
            stale,
          }),
        localPresent: runtimePresence.expoToken,
        usageCopy:
          "Repo Secret vorhanden ≠ lokaler Expo-Token vorhanden. App-seitige Expo/EAS-Schritte lesen den lokalen App-Wert; GitHub Actions lesen danach EXPO_TOKEN aus dem Repo.",
        repoCopy: "GitHub-Repo-Secret-Name fuer Actions/EAS im Ziel-Repo.",
        localCopy: "SecureStore auf diesem Geraet; getrennt vom Repo-Secret.",
      },
      {
        id: "workflowAdmin",
        title: "Lokaler Workflow Admin Key",
        repoContract:
          workflowRepoContract ??
          resolveRepoSecretVerification({
            name: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
            names,
            error,
            stale,
          }),
        localPresent: runtimePresence.workflowAdminKey,
        usageCopy:
          "Workflow-/Build-/Artifact-Routen nutzen den lokalen Workflow Admin Key aus SecureStore. Repo-Secret-Namen und lokaler App-Wert sind getrennte Readiness-Signale.",
        repoCopy: "Scoped Repo-Secret fuer Workflow-Routen: K1W1_EDGE_WORKFLOW_ADMIN_KEY.",
        localCopy: "SecureStore auf diesem Geraet fuer App → Edge Workflow-/Dispatch-Aufrufe.",
      },
      {
        id: "keystoreAdmin",
        title: "Lokaler Android Keystore Export Admin Key",
        repoContract:
          keystoreRepoContract ??
          resolveRepoSecretVerification({
            name: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
            names,
            error,
            stale,
          }),
        localPresent: runtimePresence.androidKeystoreExportAdminKey,
        usageCopy:
          "Keystore-Routen (status/generate/export) nutzen den separaten lokalen Keystore Admin Key. Ein vorhandener Workflow-Key ersetzt diesen Scope nicht.",
        repoCopy:
          "Scoped Repo-Secret fuer Keystore-Routen: K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY.",
        localCopy: "SecureStore auf diesem Geraet fuer App → Edge Keystore-Aufrufe.",
      },
    ];
  }, [
    requiredStatus,
    optionalStatus,
    names,
    error,
    stale,
    runtimePresence.expoToken,
    runtimePresence.workflowAdminKey,
    runtimePresence.androidKeystoreExportAdminKey,
  ]);

  const runtimeMissingLabels = useMemo(
    () =>
      runtimeRows
        .filter((row) => row.localPresent === false)
        .map((row) => {
          if (row.id === "expo") return "Expo-Token lokal";
          if (row.id === "workflowAdmin") return "lokaler Workflow Admin Key";
          if (row.id === "keystoreAdmin") return "lokaler Android Keystore Export Admin Key";
          return "lokaler Legacy Edge Admin Key";
        }),
    [runtimeRows],
  );

  const runtimeSummary = useMemo<RuntimeSummaryPresentation | null>(() => {
    if (!activeRepo) return null;

    if (runtimeLoading || runtimeRows.some((row) => row.localPresent === null)) {
      return {
        icon: "sync",
        color: theme.palette.text.secondary,
        title: "Lokale App-Werte werden geladen",
        body: "Repo-Secrets und lokale Laufzeit-Credentials werden getrennt angezeigt, sobald die lokalen Werte geladen sind.",
      };
    }

    if (runtimeMissingLabels.length > 0) {
      return {
        icon: "warning",
        color: theme.palette.warning,
        title: "Repo Secret ≠ Lokaler App-Wert",
        body: `Repo-Secret-Namen koennen bestaetigt sein, aber fuer App-Dispatch fehlt noch: ${runtimeMissingLabels.join(", ")}.`,
      };
    }

    return {
      icon: "checkmark-done-circle",
      color: theme.palette.primary,
      title: "Repo und lokal getrennt bestaetigt",
      body: "Die kritischen Werte sind getrennt sichtbar: Repo-Secrets fuer GitHub und getrennte lokale scoped App-Werte je Route.",
    };
  }, [activeRepo, runtimeLoading, runtimeRows, runtimeMissingLabels]);

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Secrets (Repo)</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {loading ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
          <TouchableOpacity style={styles.iconBtn} onPress={load} disabled={!parsed || loading}>
            <Ionicons
              name="refresh"
              size={18}
              color={parsed ? theme.palette.primary : theme.palette.text.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {!activeRepo ? <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>Kein Repo gewählt.</Text> : null}

      {!!error ? (
        <Text
          style={{
            fontSize: 12,
            color:
              listContract.state === "auth_error" || listContract.state === "stale"
                ? theme.palette.warning
                : theme.palette.text.secondary,
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          {error}
        </Text>
      ) : null}

      {activeRepo ? <SecretsSummaryCard summary={summary} /> : null}
      {activeRepo && runtimeSummary ? <SecretsSummaryCard summary={runtimeSummary} /> : null}

      {activeRepo ? (
        <Text style={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 17, marginTop: 8 }}>
          Auto-Sync aus der App deckt EXPO_TOKEN + SUPABASE_URL ab (optional: EAS_PROJECT_ID,
          K1W1_EDGE_WORKFLOW_ADMIN_KEY, K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY; legacy zusaetzlich Scoped
          Workflow-/Keystore-Secrets bleiben getrennte Schluessel ohne implizites Spiegeln eines Einzelwerts.
          SUPABASE_SERVICE_ROLE_KEY bleibt bewusst ein manueller Production-Schritt.
        </Text>
      ) : null}

      {activeRepo ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: theme.palette.text.primary }}>
            Laufzeit-Quellen klar getrennt
          </Text>
          {runtimeRows.map((row) => (
            <RuntimeCredentialsCard key={row.id} row={row} />
          ))}
        </View>
      ) : null}

      {activeRepo ? (
        <SecretsChecklist
          requiredStatus={requiredStatus}
          optionalStatus={optionalStatus}
          listState={listContract.state}
          requiredMissing={requiredMissing}
          summaryColor={summary.color}
        />
      ) : null}

      {activeRepo && Array.isArray(names) && names.length ? (
        <TouchableOpacity
          style={[styles.button, { marginTop: 12 }]}
          onPress={() => {
            Alert.alert("Secrets", names.join("\n"));
          }}
        >
          <Text style={styles.buttonText}>
            {listContract.state === "stale" ? `Zuletzt bestätigt anzeigen (${names.length})` : `Alle anzeigen (${names.length})`}
          </Text>
        </TouchableOpacity>
      ) : null}

      {activeRepo && onSyncSecrets ? (
        <TouchableOpacity
          style={[styles.button, { marginTop: 10 }, (syncing || !parsed) && styles.buttonDisabled]}
          onPress={onSyncSecrets}
          disabled={syncing || !parsed}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={theme.palette.primary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.palette.primary} />
              <Text style={styles.buttonText}>Secrets synchronisieren</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
