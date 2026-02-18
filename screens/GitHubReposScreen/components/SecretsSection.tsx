import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";
import { splitFullName } from "../utils/repos";
import { listRepoSecretNames } from "../../../infra/github/githubService";

const EXPECTED_SECRETS = [
  "EXPO_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EAS_PROJECT_ID",
  "K1W1_EDGE_ADMIN_KEY",
] as const;

export function SecretsSection(props: { activeRepo: string | null }) {
  const { activeRepo } = props;

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

  const expectedStatus = useMemo(() => {
    const set = new Set(names);
    return EXPECTED_SECRETS.map((n) => ({ name: n, ok: set.has(n) }));
  }, [names]);

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
          {expectedStatus.map((s) => (
            <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name={s.ok ? "checkmark-circle" : "close-circle"}
                size={16}
                color={s.ok ? theme.palette.primary : theme.palette.text.muted}
              />
              <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>{s.name}</Text>
            </View>
          ))}
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
    </View>
  );
}
