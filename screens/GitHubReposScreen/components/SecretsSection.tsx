import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";
import { splitFullName } from "../utils/repos";
import { listRepoSecretNames } from "../../../infra/github/githubService";

const REQUIRED_SECRETS = [
  "EXPO_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EAS_PROJECT_ID",
] as const;

const OPTIONAL_SECRETS = [
  // Nice-to-have; not required for basic build/test flows
  "K1W1_EDGE_ADMIN_KEY",
] as const;

export function SecretsSection(props: {
  activeRepo: string | null;
  onSyncSecrets?: () => void;
  syncing?: boolean;
}) {
  const { activeRepo, onSyncSecrets, syncing } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>([]);

  const parsed = useMemo(() => (activeRepo ? splitFullName(activeRepo) : null), [activeRepo]);

  const load = useCallback(async () => {
    if (!parsed) {
      setNames([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listRepoSecretNames(parsed.owner, parsed.repo);
      setNames(list);
    } catch (e: any) {
      setError(e?.message || "Secrets konnten nicht geladen werden.");
      setNames([]);
    } finally {
      setLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    load();
  }, [load]);

  const requiredStatus = useMemo(() => {
    const set = new Set(names);
    return REQUIRED_SECRETS.map((n) => ({ name: n, ok: set.has(n) }));
  }, [names]);

  const optionalStatus = useMemo(() => {
    const set = new Set(names);
    return OPTIONAL_SECRETS.map((n) => ({ name: n, ok: set.has(n) }));
  }, [names]);

  const requiredMissing = useMemo(() => requiredStatus.some((s) => !s.ok), [requiredStatus]);


  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Secrets</Text>
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
        <Text style={{ fontSize: 12, color: theme.palette.error, marginTop: 6, lineHeight: 18 }}>
          {error}
        </Text>
      ) : null}

      {activeRepo ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: requiredMissing ? theme.palette.error : theme.palette.text.secondary,
            }}
          >
            Required
          </Text>

          {requiredStatus.map((s) => (
            <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name={s.ok ? "checkmark-circle" : "close-circle"}
                size={16}
                color={s.ok ? theme.palette.primary : theme.palette.error}
              />
              <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>{s.name}</Text>
            </View>
          ))}

          {optionalStatus.length ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: theme.palette.text.secondary }}>
                Optional
              </Text>
              {optionalStatus.map((s) => (
                <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons
                    name={s.ok ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={s.ok ? theme.palette.primary : theme.palette.text.muted}
                  />
                  <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>{s.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {activeRepo && names.length ? (
        <TouchableOpacity
          style={[styles.button, { marginTop: 12 }]}
          onPress={() => {
            Alert.alert("Secrets", names.join("\n"));
          }}
        >
          <Text style={styles.buttonText}>Alle anzeigen ({names.length})</Text>
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
