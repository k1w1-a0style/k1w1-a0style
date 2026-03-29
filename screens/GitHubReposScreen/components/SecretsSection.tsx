import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";
import { splitFullName } from "../utils/repos";
import {
  getAndroidKeystoreExportAdminKey,
  getLegacyEdgeAdminKey,
  getExpoToken,
  getWorkflowAdminKey,
  listRepoSecretNames,
} from "../../../infra/github/githubService";
import { describeRepoSecretContract } from "../../../lib/diagnostics/buildPipelineDiagnostics";
import {
  resolveRepoSecretListVerification,
  resolveRepoSecretVerification,
} from "../../../lib/status/repoSecretVerification";

const REQUIRED_SECRETS = ["EXPO_TOKEN", "SUPABASE_URL"] as const;

const OPTIONAL_SECRETS = [
  // Optional or flow-specific in app-managed sync paths
  "EAS_PROJECT_ID",
  "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
  "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
  "K1W1_EDGE_ADMIN_KEY",
  // Production/Supabase report secret stays manual-only
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type SecretRow = {
  name: string;
  contract: ReturnType<typeof resolveRepoSecretVerification>;
};

type RuntimeCredentialRow = {
  id: "expo" | "workflowAdmin" | "keystoreAdmin" | "legacyEdgeAdmin";
  title: string;
  repoContract: ReturnType<typeof resolveRepoSecretVerification>;
  localPresent: boolean | null;
  usageCopy: string;
  repoCopy: string;
  localCopy: string;
};

export function SecretsSection(props: {
  activeRepo: string | null;
  onSyncSecrets?: () => void;
  syncing?: boolean;
}) {
  const { activeRepo, onSyncSecrets, syncing } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<string[] | null>(null);
  const [stale, setStale] = useState(false);
  const [runtimePresence, setRuntimePresence] = useState<{
    expoToken: boolean | null;
    workflowAdminKey: boolean | null;
    androidKeystoreExportAdminKey: boolean | null;
    legacyEdgeAdminKey: boolean | null;
  }>({
    expoToken: null,
    workflowAdminKey: null,
    androidKeystoreExportAdminKey: null,
    legacyEdgeAdminKey: null,
  });
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const requestRef = useRef(0);
  const runtimeRequestRef = useRef(0);
  const hasVerifiedNamesRef = useRef(false);

  const parsed = useMemo(() => (activeRepo ? splitFullName(activeRepo) : null), [activeRepo]);

  const load = useCallback(async () => {
    if (!parsed) {
      setNames(null);
      setStale(false);
      setError(null);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const hadVerifiedNames = hasVerifiedNamesRef.current;

    setLoading(true);
    setError(null);

    try {
      const list = await listRepoSecretNames(parsed.owner, parsed.repo);
      if (requestRef.current !== requestId) return;
      hasVerifiedNamesRef.current = true;
      setNames(list);
      setStale(false);
    } catch (e: any) {
      if (requestRef.current !== requestId) return;
      setError(e?.message || "Secrets konnten nicht geladen werden.");
      setStale(hadVerifiedNames);
      if (!hadVerifiedNames) {
        setNames(null);
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [parsed]);

  const loadRuntimePresence = useCallback(async () => {
    if (!activeRepo) {
      setRuntimePresence({
        expoToken: null,
        workflowAdminKey: null,
        androidKeystoreExportAdminKey: null,
        legacyEdgeAdminKey: null,
      });
      setRuntimeLoading(false);
      return;
    }

    const requestId = runtimeRequestRef.current + 1;
    runtimeRequestRef.current = requestId;
    setRuntimeLoading(true);

    try {
      const [expoToken, workflowAdminKey, androidKeystoreExportAdminKey, legacyEdgeAdminKey] = await Promise.all([
        getExpoToken().catch(() => null),
        getWorkflowAdminKey().catch(() => null),
        getAndroidKeystoreExportAdminKey().catch(() => null),
        getLegacyEdgeAdminKey().catch(() => null),
      ]);
      if (runtimeRequestRef.current !== requestId) return;
      setRuntimePresence({
        expoToken: !!expoToken?.trim(),
        workflowAdminKey: !!workflowAdminKey?.trim(),
        androidKeystoreExportAdminKey: !!androidKeystoreExportAdminKey?.trim(),
        legacyEdgeAdminKey: !!legacyEdgeAdminKey?.trim(),
      });
    } finally {
      if (runtimeRequestRef.current === requestId) {
        setRuntimeLoading(false);
      }
    }
  }, [activeRepo]);

  useEffect(() => {
    requestRef.current += 1;
    hasVerifiedNamesRef.current = false;
    setNames(null);
    setError(null);
    setStale(false);
    setLoading(false);

    runtimeRequestRef.current += 1;
    setRuntimePresence({
      expoToken: null,
      workflowAdminKey: null,
      androidKeystoreExportAdminKey: null,
      legacyEdgeAdminKey: null,
    });
    setRuntimeLoading(false);
  }, [activeRepo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void loadRuntimePresence();
  }, [loadRuntimePresence]);

  const listContract = useMemo(
    () =>
      resolveRepoSecretListVerification({
        names,
        error,
        stale,
      }),
    [error, names, stale],
  );

  const requiredStatus = useMemo(
    () =>
      REQUIRED_SECRETS.map((name) => ({
        name,
        contract: resolveRepoSecretVerification({
          name,
          names,
          error,
          stale,
        }),
      })),
    [error, names, stale],
  );

  const optionalStatus = useMemo(
    () =>
      OPTIONAL_SECRETS.map((name) => ({
        name,
        contract: resolveRepoSecretVerification({
          name,
          names,
          error,
          stale,
        }),
      })),
    [error, names, stale],
  );

  const requiredMissing = useMemo(
    () => requiredStatus.some((entry) => entry.contract.isHardMissing),
    [requiredStatus],
  );

  const summary = useMemo(() => {
    if (listContract.state === "verified" && !requiredMissing) {
      return {
        icon: "checkmark-circle" as const,
        color: theme.palette.primary,
        title: "Secret-Namen bestätigt",
        body:
          "GitHub hat die aktuelle Repo-Secret-Namensliste bestätigt. Die Pflicht-Secrets sind vorhanden.",
      };
    }

    if (listContract.state === "verified") {
      return {
        icon: "alert-circle" as const,
        color: theme.palette.error,
        title: "Bestätigt, aber unvollständig",
        body:
          "GitHub hat die Repo-Secret-Namensliste bestätigt, aber mindestens ein Pflicht-Secret fehlt.",
      };
    }

    if (listContract.state === "auth_error") {
      return {
        icon: "lock-closed" as const,
        color: theme.palette.warning,
        title: "Zugriff auf Repo-Secrets blockiert",
        body:
          "Die Secret-Namen konnten mit diesem GitHub-Zugriff nicht verifiziert werden. Das ist kein sicher bestätigtes 'fehlt'.",
      };
    }

    if (listContract.state === "stale") {
      return {
        icon: "time" as const,
        color: theme.palette.warning,
        title: "Zuletzt bestätigte Secret-Namen sind veraltet",
        body:
          "Die zuletzt bestätigte Namensliste ist noch sichtbar, aber der aktuelle Recheck ist fehlgeschlagen. Bitte erneut prüfen.",
      };
    }

    return {
      icon: "help-circle" as const,
      color: theme.palette.text.secondary,
      title: "Repo-Secret-Prüfung aktuell unklar",
      body:
        "Die Secret-Namen konnten aktuell nicht sicher geladen werden. Fehlend wird erst nach bestätigter Namensliste angezeigt.",
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
    const legacyRepoContract = optionalStatus.find((entry) => entry.name === "K1W1_EDGE_ADMIN_KEY")?.contract;

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
        repoCopy:
          "Scoped Repo-Secret fuer Workflow-Routen: K1W1_EDGE_WORKFLOW_ADMIN_KEY.",
        localCopy:
          "SecureStore auf diesem Geraet fuer App → Edge Workflow-/Dispatch-Aufrufe.",
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
        localCopy:
          "SecureStore auf diesem Geraet fuer App → Edge Keystore-Aufrufe.",
      },
      {
        id: "legacyEdgeAdmin",
        title: "Lokaler Legacy Edge Admin Key (compat)",
        repoContract:
          legacyRepoContract ??
          resolveRepoSecretVerification({
            name: "K1W1_EDGE_ADMIN_KEY",
            names,
            error,
            stale,
          }),
        localPresent: runtimePresence.legacyEdgeAdminKey,
        usageCopy:
          "Legacy-Compat sichtbar (Sunset): nur fuer alte Runtime-Pfade wie k1w1-handler/save_preview, nicht als allgemeiner Readiness-Anker.",
        repoCopy: "Legacy-Repo-Secret K1W1_EDGE_ADMIN_KEY (nur Compat/Sunset, kein Scoped-Primärvertrag).",
        localCopy: "SecureStore-Legacywert fuer Altpfade; aktuelle Workflow-/Keystore-Flows bleiben scoped-only.",
      },
    ];
  }, [error, names, optionalStatus, requiredStatus, runtimePresence.workflowAdminKey, runtimePresence.androidKeystoreExportAdminKey, runtimePresence.legacyEdgeAdminKey, runtimePresence.expoToken, stale]);

  const runtimeMissingLabels = useMemo(() => {
    return runtimeRows
      .filter((row) => row.localPresent === false && row.id !== "legacyEdgeAdmin")
      .map((row) => {
        if (row.id === "expo") return "Expo-Token lokal";
        if (row.id === "workflowAdmin") return "lokaler Workflow Admin Key";
        if (row.id === "keystoreAdmin") return "lokaler Android Keystore Export Admin Key";
        return "lokaler Legacy Edge Admin Key";
      });
  }, [runtimeRows]);

  const runtimeSummary = useMemo(() => {
    if (!activeRepo) return null;

    if (runtimeLoading || runtimeRows.some((row) => row.localPresent === null)) {
      return {
        icon: "sync" as const,
        color: theme.palette.text.secondary,
        title: "Lokale App-Werte werden geladen",
        body:
          "Repo-Secrets und lokale Laufzeit-Credentials werden getrennt angezeigt, sobald die lokalen Werte geladen sind.",
      };
    }

    if (runtimeMissingLabels.length > 0) {
      return {
        icon: "warning" as const,
        color: theme.palette.warning,
        title: "Repo Secret ≠ Lokaler App-Wert",
        body: `Repo-Secret-Namen koennen bestaetigt sein, aber fuer App-Dispatch fehlt noch: ${runtimeMissingLabels.join(", ")}.`,
      };
    }

    return {
      icon: "checkmark-done-circle" as const,
      color: theme.palette.primary,
      title: "Repo und lokal getrennt bestaetigt",
      body:
          "Die kritischen Werte sind getrennt sichtbar: Repo-Secrets fuer GitHub und getrennte lokale scoped App-Werte je Route.",
    };
  }, [activeRepo, runtimeLoading, runtimeMissingLabels, runtimeRows]);

  const renderSecretRow = useCallback((entry: SecretRow, optional = false) => {
    const { contract, name } = entry;
    const presentation = describeRepoSecretContract({
      name,
      state: contract.state,
      optional,
    });

    const statusText =
      contract.state === "verified"
        ? "bestätigt"
        : contract.state === "missing"
          ? "fehlt"
          : contract.state === "auth_error"
            ? "auth-blockiert"
            : contract.state === "stale"
              ? "veraltet"
              : "unklar";

    const iconName =
      contract.state === "verified"
        ? "checkmark-circle"
        : contract.state === "missing"
          ? "close-circle"
          : contract.state === "auth_error"
            ? "lock-closed"
            : contract.state === "stale"
              ? "time"
              : "help-circle";

    const color =
      contract.state === "verified"
        ? theme.palette.primary
        : contract.state === "missing"
          ? optional
            ? theme.palette.warning
            : theme.palette.error
          : contract.state === "auth_error" || contract.state === "stale"
            ? theme.palette.warning
            : theme.palette.text.secondary;

    return (
      <View key={name} style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name={iconName} size={16} color={color} />
          <Text style={{ flex: 1, fontSize: 12, color: theme.palette.text.secondary }}>{name}</Text>
          <Text style={{ fontSize: 11, fontWeight: "800", color }}>{statusText}</Text>
        </View>
        {presentation.fixHint ? (
          <Text
            style={{
              marginLeft: 24,
              fontSize: 11,
              lineHeight: 16,
              color:
                presentation.status === "pass"
                  ? theme.palette.text.secondary
                  : presentation.status === "fail"
                    ? theme.palette.error
                    : theme.palette.warning,
            }}
          >
            {presentation.fixHint}
          </Text>
        ) : null}
      </View>
    );
  }, []);

  const renderRuntimeSourceRow = useCallback(
    (
      label: "Repo Secret" | "Lokaler App-Wert",
      state: ReturnType<typeof resolveRepoSecretVerification>["state"] | "present" | "missing" | "loading",
      copy: string,
    ) => {
      const iconName =
        state === "verified" || state === "present"
          ? "checkmark-circle"
          : state === "missing"
            ? "close-circle"
            : state === "auth_error"
              ? "lock-closed"
              : state === "stale" || state === "loading"
                ? "time"
                : "help-circle";

      const color =
        state === "verified" || state === "present"
          ? theme.palette.primary
          : state === "missing"
            ? theme.palette.warning
            : state === "auth_error" || state === "stale"
              ? theme.palette.warning
              : theme.palette.text.secondary;

      const statusText =
        state === "verified"
          ? "bestätigt"
          : state === "present"
            ? "vorhanden"
            : state === "missing"
              ? "fehlt"
              : state === "auth_error"
                ? "auth-blockiert"
                : state === "stale"
                  ? "veraltet"
                  : state === "loading"
                    ? "lädt"
                    : "unklar";

      return (
        <View
          style={{
            gap: 4,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: `${color}33`,
            backgroundColor: `${color}10`,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={iconName} size={15} color={color} />
            <Text style={{ flex: 1, fontSize: 11, fontWeight: "800", color: theme.palette.text.primary }}>
              {label}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: "900", color }}>{statusText}</Text>
          </View>
          <Text style={{ fontSize: 11, lineHeight: 16, color: theme.palette.text.secondary }}>{copy}</Text>
        </View>
      );
    },
    [],
  );

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

      {!activeRepo ? (
        <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>
          Kein Repo gewählt.
        </Text>
      ) : null}

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

      {activeRepo ? (
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: `${summary.color}55`,
            backgroundColor: `${summary.color}12`,
            borderRadius: 12,
            padding: 10,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={summary.icon} size={16} color={summary.color} />
            <Text style={{ fontSize: 12, fontWeight: "900", color: summary.color }}>{summary.title}</Text>
          </View>
          <Text style={{ fontSize: 11, lineHeight: 17, color: theme.palette.text.secondary }}>
            {summary.body}
          </Text>
        </View>
      ) : null}

      {activeRepo && runtimeSummary ? (
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: `${runtimeSummary.color}55`,
            backgroundColor: `${runtimeSummary.color}12`,
            borderRadius: 12,
            padding: 10,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={runtimeSummary.icon} size={16} color={runtimeSummary.color} />
            <Text style={{ fontSize: 12, fontWeight: "900", color: runtimeSummary.color }}>
              {runtimeSummary.title}
            </Text>
          </View>
          <Text style={{ fontSize: 11, lineHeight: 17, color: theme.palette.text.secondary }}>
            {runtimeSummary.body}
          </Text>
        </View>
      ) : null}

      {activeRepo ? (
        <Text style={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 17, marginTop: 8 }}>
          Auto-Sync aus der App deckt EXPO_TOKEN + SUPABASE_URL ab (optional: EAS_PROJECT_ID,
          K1W1_EDGE_WORKFLOW_ADMIN_KEY, K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY; legacy zusaetzlich
          K1W1_EDGE_ADMIN_KEY). Scoped Workflow-/Keystore-Secrets bleiben getrennte Schluessel ohne
          implizites Spiegeln eines Einzelwerts. SUPABASE_SERVICE_ROLE_KEY bleibt bewusst ein manueller Production-Schritt.
        </Text>
      ) : null}

      {activeRepo ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: theme.palette.text.primary }}>
            Laufzeit-Quellen klar getrennt
          </Text>
          {runtimeRows.map((row) => (
            <View
              key={row.id}
              style={{
                gap: 8,
                padding: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: `${theme.palette.primary}22`,
                backgroundColor: theme.palette.card,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "900", color: theme.palette.text.primary }}>
                {row.title}
              </Text>
              <View style={{ gap: 6 }}>
                {renderRuntimeSourceRow("Repo Secret", row.repoContract.state, row.repoCopy)}
                {renderRuntimeSourceRow(
                  "Lokaler App-Wert",
                  row.localPresent === null ? "loading" : row.localPresent ? "present" : "missing",
                  row.localCopy,
                )}
              </View>
              <Text style={{ fontSize: 11, lineHeight: 17, color: theme.palette.text.secondary }}>
                {row.usageCopy}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {activeRepo ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color:
                listContract.state === "verified"
                  ? requiredMissing
                    ? theme.palette.error
                    : theme.palette.primary
                  : listContract.state === "auth_error" || listContract.state === "stale"
                    ? theme.palette.warning
                    : theme.palette.text.secondary,
            }}
          >
            Required
          </Text>

          {requiredStatus.map((entry) => renderSecretRow(entry))}

          {optionalStatus.length ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: listContract.state === "verified" ? theme.palette.text.secondary : summary.color,
                }}
              >
                Optional
              </Text>
              {optionalStatus.map((entry) => renderSecretRow(entry, true))}
            </View>
          ) : null}
        </View>
      ) : null}

      {activeRepo && Array.isArray(names) && names.length ? (
        <TouchableOpacity
          style={[styles.button, { marginTop: 12 }]}
          onPress={() => {
            Alert.alert("Secrets", names.join("\n"));
          }}
        >
          <Text style={styles.buttonText}>
            {listContract.state === "stale"
              ? `Zuletzt bestätigt anzeigen (${names.length})`
              : `Alle anzeigen (${names.length})`}
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
