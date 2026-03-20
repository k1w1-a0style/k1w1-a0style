import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";
import { splitFullName } from "../utils/repos";
import { listRepoSecretNames } from "../../../infra/github/githubService";
import { describeRepoSecretContract } from "../../../lib/diagnostics/buildPipelineDiagnostics";
import {
  resolveRepoSecretListVerification,
  resolveRepoSecretVerification,
} from "../../../lib/status/repoSecretVerification";

const REQUIRED_SECRETS = [
  "EXPO_TOKEN",
  "SUPABASE_URL",
] as const;

const OPTIONAL_SECRETS = [
  // Optional or flow-specific in app-managed sync paths
  "EAS_PROJECT_ID",
  "K1W1_EDGE_ADMIN_KEY",
  // Production/Supabase report secret stays manual-only
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type SecretRow = {
  name: string;
  contract: ReturnType<typeof resolveRepoSecretVerification>;
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
  const requestRef = useRef(0);

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
    const hadVerifiedNames = Array.isArray(names);

    setLoading(true);
    setError(null);

    try {
      const list = await listRepoSecretNames(parsed.owner, parsed.repo);
      if (requestRef.current !== requestId) return;
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
  }, [names, parsed]);

  useEffect(() => {
    requestRef.current += 1;
    setNames(null);
    setError(null);
    setStale(false);
    setLoading(false);
  }, [activeRepo]);

  useEffect(() => {
    load();
  }, [load]);

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

      {activeRepo ? (
        <Text style={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 17, marginTop: 8 }}>
          Auto-Sync aus der App deckt EXPO_TOKEN + SUPABASE_URL ab (optional: EAS_PROJECT_ID, K1W1_EDGE_ADMIN_KEY).
          SUPABASE_SERVICE_ROLE_KEY bleibt bewusst ein manueller Production-Schritt.
        </Text>
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
