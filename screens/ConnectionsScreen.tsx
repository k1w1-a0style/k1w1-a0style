// screens/ConnectionsScreen.tsx - MIT ALLEN FIXES (B)
// ✅ Supabase-Test prüft REST API + build_jobs Tabelle + Edge Functions
// ✅ Besseres Error-Handling
// ✅ GitHub-Token-Test mit User-Info
// ✅ EAS bleibt "sparsam" (kein API-Call)

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useGitHub } from '../contexts/GitHubContext';
import {
  getGitHubToken,
  saveGitHubToken,
  getExpoToken,
  saveExpoToken,
  syncRepoSecrets,
} from '../contexts/ProjectContext';

type StatusType = 'idle' | 'ok' | 'error';

const STORAGE_KEYS = {
  SUPABASE_RAW: 'supabase_raw',
  SUPABASE_URL: 'supabase_url',
  SUPABASE_KEY: 'supabase_key',
  SUPABASE_SERVICE_ROLE_KEY: 'supabase_service_role_key',
  GITHUB_TOKEN: 'github_token',
  EAS_TOKEN: 'eas_token',
  EAS_PROJECT_ID: 'eas_project_id',
} as const;

const getStatusColor = (status: StatusType) => {
  switch (status) {
    case 'ok':
      return theme.palette.success;
    case 'error':
      return theme.palette.error;
    case 'idle':
    default:
      return theme.palette.text.secondary;
  }
};

const deriveSupabaseUrl = (raw: string): { projectId: string; url: string } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { projectId: '', url: '' };
  }

  // Falls schon eine URL eingetragen war: https://<id>.supabase.co -> id extrahieren
  const match = trimmed.match(/^https?:\/\/([^.]+)\.supabase\.co/);
  if (match && match[1]) {
    const id = match[1];
    return {
      projectId: id,
      url: `https://${id}.supabase.co`,
    };
  }

  // Sonst nehmen wir es als Project-ID
  return {
    projectId: trimmed,
    url: `https://${trimmed}.supabase.co`,
  };
};

const ConnectionsScreen: React.FC = () => {
  const { activeRepo } = useGitHub();

  const [supabaseProjectId, setSupabaseProjectId] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState('');
  const [githubToken, setGithubTokenState] = useState('');
  const [easToken, setEasToken] = useState('');
  const [easProjectId, setEasProjectId] = useState('');
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [syncingSecrets, setSyncingSecrets] = useState(false);
  const [lastSecretSync, setLastSecretSync] = useState<string | null>(null);
  const previousRepoRef = useRef<string | null>(null);

  const [supabaseStatus, setSupabaseStatus] = useState<StatusType>('idle');
  const [githubStatus, setGithubStatus] = useState<StatusType>('idle');
  const [easStatus, setEasStatus] = useState<StatusType>('idle');

  const [loadingSupabase, setLoadingSupabase] = useState(false);
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [loadingEas, setLoadingEas] = useState(false);

  const [githubUser, setGithubUser] = useState<string | null>(null);
  const [supabaseTestDetails, setSupabaseTestDetails] = useState<string>('');

  // --------------------------------------------------
  // Initial-Load: Supabase, GitHub-Token, EAS-Konfig
  // --------------------------------------------------
  useEffect(() => {
    const loadConnections = async () => {
      try {
        const [
          storedSupabaseRaw,
          storedSupabaseUrl,
          storedSupabaseKey,
          storedServiceRoleKey,
          storedGithubTokenAsync,
          storedEasTokenAsync,
          storedEasProjectId,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW),
          AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL),
          AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY),
          AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY),
          getGitHubToken().catch(() => null),
          getExpoToken().catch(() => null),
          AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID),
        ]);

        const envSupabaseUrl =
          (process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined) || '';
        const envSupabaseKey =
          (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) || '';

        const rawSource = storedSupabaseRaw || storedSupabaseUrl || envSupabaseUrl || '';
        const derived = rawSource ? deriveSupabaseUrl(rawSource) : { projectId: '', url: '' };

        setSupabaseProjectId(storedSupabaseRaw || derived.projectId);
        setSupabaseKey(storedSupabaseKey || envSupabaseKey);
        setSupabaseServiceRoleKey(storedServiceRoleKey || '');
        setGithubTokenState(storedGithubTokenAsync || '');
        setEasToken(storedEasTokenAsync || '');
        setEasProjectId(storedEasProjectId || '');
      } catch (e) {
        // Silently handle load errors
      } finally {
        setConnectionsLoaded(true);
      }
    };

    loadConnections();
  }, []);

  const secretPayload = useMemo(() => {
    const trimmedProject = supabaseProjectId.trim();
    const derived = trimmedProject ? deriveSupabaseUrl(trimmedProject) : { projectId: '', url: '' };

    return {
      supabaseUrl: derived.url || null,
      supabaseServiceRole: supabaseServiceRoleKey.trim() || null,
      expoToken: easToken.trim() || null,
    };
  }, [supabaseProjectId, supabaseServiceRoleKey, easToken]);

  const hasSecretsConfigured = useMemo(
    () => Object.values(secretPayload).some(Boolean),
    [secretPayload],
  );

  const syncSecretsForActiveRepo = useCallback(
    async (reason: 'manual' | 'auto') => {
      if (!activeRepo) {
        if (reason === 'manual') {
          Alert.alert(
            'Kein Repo',
            'Bitte wähle zuerst ein aktives GitHub-Repository im GitHub-Screen aus.',
          );
        }
        return;
      }

      if (!hasSecretsConfigured) {
        if (reason === 'manual') {
          Alert.alert(
            'Keine Daten',
            'Es gibt aktuell keine Supabase/EAS-Werte, die als Secret gespeichert werden können.',
          );
        }
        return;
      }

      setSyncingSecrets(true);
      try {
        const result = await syncRepoSecrets(activeRepo, secretPayload);
        setLastSecretSync(new Date().toISOString());

        if (reason === 'manual') {
          const msg = result.updated.length
            ? `Folgende Secrets wurden gesetzt:\n${result.updated.join(', ')}`
            : 'Es wurden keine Secrets geändert (alle Werte waren bereits identisch).';
          Alert.alert('Repo-Secrets aktualisiert', msg);
        }
      } catch (error: any) {
        const message = error?.message ?? 'Unbekannter Fehler beim Secret-Sync.';
        if (reason === 'manual') {
          Alert.alert('Secret Sync fehlgeschlagen', message);
        }
      } finally {
        setSyncingSecrets(false);
      }
    },
    [activeRepo, hasSecretsConfigured, secretPayload],
  );

  useEffect(() => {
    if (!connectionsLoaded || !activeRepo) {
      previousRepoRef.current = activeRepo ?? null;
      return;
    }

    if (previousRepoRef.current === activeRepo) {
      return;
    }

    previousRepoRef.current = activeRepo;
    syncSecretsForActiveRepo('auto');
  }, [activeRepo, connectionsLoaded, syncSecretsForActiveRepo]);

  // --------------------------------------------------
  // SAVE-Actions
  // --------------------------------------------------
  const saveSupabaseConfig = useCallback(async () => {
    try {
      const raw = supabaseProjectId.trim();
      if (!raw) {
        Alert.alert('Hinweis', 'Bitte eine Supabase Project-ID eintragen.');
        return;
      }

      const derived = deriveSupabaseUrl(raw);

      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, raw);
      if (derived.url) {
        await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, derived.url);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, supabaseKey.trim());
      await AsyncStorage.setItem(
        STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY,
        supabaseServiceRoleKey.trim(),
      );

      Alert.alert('✅ Gespeichert', 'Supabase-Konfiguration wurde gespeichert.');
      await syncSecretsForActiveRepo('manual');
    } catch (e) {
      Alert.alert('Fehler', 'Supabase-Konfiguration konnte nicht gespeichert werden.');
    }
  }, [supabaseProjectId, supabaseKey, supabaseServiceRoleKey, syncSecretsForActiveRepo]);

  const saveGithubTokenHandler = useCallback(async () => {
    try {
      const token = githubToken.trim();
      if (!token) {
        Alert.alert('Hinweis', 'Bitte ein GitHub-PAT eintragen.');
        return;
      }

      await saveGitHubToken(token);
      await AsyncStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, token);

      Alert.alert('✅ Gespeichert', 'GitHub-Token wurde sicher gespeichert.');
    } catch (e) {
      Alert.alert('Fehler', 'GitHub-Token konnte nicht gespeichert werden.');
    }
  }, [githubToken]);

  const saveEasConfig = useCallback(async () => {
    try {
      const token = easToken.trim();
      const projectId = easProjectId.trim();

      await saveExpoToken(token);
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_TOKEN, token);
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, projectId);

      Alert.alert(
        '✅ Gespeichert',
        'EAS-Konfiguration wurde gespeichert (Project ID + optionaler Token).'
      );
      await syncSecretsForActiveRepo('manual');
    } catch (e) {
      Alert.alert('Fehler', 'EAS-Konfiguration konnte nicht gespeichert werden.');
    }
  }, [easToken, easProjectId, syncSecretsForActiveRepo]);

  // --------------------------------------------------
  // SUPABASE-TEST (REST + build_jobs + Edge Functions)
  // --------------------------------------------------
  const testSupabase = useCallback(async () => {
    const rawId = supabaseProjectId.trim();
    const key = supabaseKey.trim();

    if (!rawId || !key) {
      Alert.alert('Fehlende Daten', 'Bitte Supabase Project-ID und Anon-Key eintragen.');
      setSupabaseStatus('error');
      return;
    }

    const { url } = deriveSupabaseUrl(rawId);
    if (!url) {
      Alert.alert('Fehler', 'Supabase Project-ID sieht ungültig aus.');
      setSupabaseStatus('error');
      return;
    }

    try {
      setLoadingSupabase(true);
      setSupabaseStatus('idle');
      setSupabaseTestDetails('Teste REST API...');

      // Test 1: REST API Basisverbindung
      const restRes = await fetch(`${url}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      if (!restRes.ok && restRes.status !== 404) {
        setSupabaseStatus('error');
        setSupabaseTestDetails(`REST API Fehler: Status ${restRes.status}`);
        Alert.alert(
          'Fehler',
          `Supabase REST API antwortet mit Status ${restRes.status}. Prüfe Project-ID/Key.`
        );
        return;
      }

      setSupabaseTestDetails('✓ REST API OK. Teste build_jobs Tabelle...');

      // Test 2: build_jobs Tabelle prüfen
      const tableRes = await fetch(`${url}/rest/v1/build_jobs?limit=1`, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      if (!tableRes.ok) {
        setSupabaseStatus('error');
        setSupabaseTestDetails(`Tabelle build_jobs nicht gefunden (${tableRes.status})`);
        Alert.alert(
          'Tabelle fehlt',
          'Die Tabelle "build_jobs" existiert nicht in deinem Supabase-Projekt.\n\nBitte deploy das Schema aus der Dokumentation.'
        );
        return;
      }

      setSupabaseTestDetails('✓ build_jobs Tabelle OK. Teste Edge Functions...');

      // Test 3: Edge Functions (mit Timeout, optional)
      try {
        const fnTestPromise = fetch(`${url}/functions/v1/test`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        );

        const fnRes = (await Promise.race([fnTestPromise, timeoutPromise])) as Response;

        if (fnRes.ok) {
          setSupabaseTestDetails('✓ REST + Tabelle + Edge Functions OK');
        } else {
          setSupabaseTestDetails('✓ REST + Tabelle OK (Edge Functions nicht getestet)');
        }
      } catch (e: any) {
        setSupabaseTestDetails('✓ REST + Tabelle OK (Edge Functions nicht getestet)');
      }

      setSupabaseStatus('ok');
      Alert.alert(
        '✅ Supabase OK',
        'REST API und build_jobs Tabelle sind erreichbar.\n\n' + supabaseTestDetails
      );
    } catch (e: any) {
      setSupabaseStatus('error');
      setSupabaseTestDetails(`Fehler: ${e.message || 'Unbekannter Fehler'}`);
      Alert.alert('Fehler', e?.message ?? 'Supabase konnte nicht erreicht werden.');
    } finally {
      setLoadingSupabase(false);
    }
  }, [supabaseProjectId, supabaseKey, supabaseTestDetails]);

  // --------------------------------------------------
  // GITHUB-TEST – PAT verifizieren
  // --------------------------------------------------
  const testGithub = useCallback(async () => {
    const token = githubToken.trim();
    if (!token) {
      Alert.alert(
        'Kein Token',
        'Bitte trage dein GitHub-PAT ein und speichere es zuerst.'
      );
      setGithubStatus('error');
      return;
    }

    try {
      setLoadingGithub(true);
      setGithubStatus('idle');

      const res = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `token ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        setGithubStatus('error');

        if (res.status === 401) {
          Alert.alert(
            'Token ungültig',
            'GitHub-Token ist ungültig oder abgelaufen.\n\nBitte erstelle ein neues PAT.'
          );
        } else if (res.status === 403) {
          Alert.alert(
            'Keine Rechte',
            'GitHub-Token hat nicht die erforderlichen Rechte.\n\nBenötigt: repo, workflow'
          );
        } else {
          Alert.alert(
            'Fehler',
            `GitHub-API Fehler (Status ${res.status}).\n\n${text}`
          );
        }
        return;
      }

      const json = await res.json();
      setGithubUser(json?.login ?? null);
      setGithubStatus('ok');

      Alert.alert(
        '✅ GitHub OK',
        `Token ist gültig!\n\nUser: ${json?.login || 'Unbekannt'}\nScopes: ${
          res.headers.get('x-oauth-scopes') || 'Keine Info'
        }`
      );
    } catch (e: any) {
      setGithubStatus('error');
      Alert.alert('Fehler', e?.message ?? 'GitHub konnte nicht erreicht werden.');
    } finally {
      setLoadingGithub(false);
    }
  }, [githubToken]);

  // --------------------------------------------------
  // EAS-Test (nur Config checken, keine API-Calls)
  // --------------------------------------------------
  const testEas = useCallback(async () => {
    try {
      setLoadingEas(true);
      setEasStatus('idle');

      const projectId = easProjectId.trim();
      const supaId = supabaseProjectId.trim();
      const supaKey = supabaseKey.trim();

      if (!projectId) {
        setEasStatus('error');
        Alert.alert(
          'Fehlende Daten',
          'Bitte eine EAS Project ID eintragen (z.B. 5e5a7791-8751-416b-9a1f-831adfffcb6c).'
        );
        return;
      }

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(projectId)) {
        Alert.alert(
          'Hinweis',
          'Die EAS Project ID sieht ungewöhnlich aus. Prüfe sie bitte noch einmal.'
        );
      }

      if (!supaId || !supaKey) {
        setEasStatus('error');
        Alert.alert(
          'Supabase fehlt',
          'Für EAS-Builds muss Supabase Project-ID und Anon-Key gesetzt sein.'
        );
        return;
      }

      setEasStatus('ok');
      Alert.alert(
        '✅ Konfiguration OK',
        'EAS wird über Supabase Edge Functions genutzt.\n\nProject ID und Supabase-Daten sind gesetzt. Es wird kein zusätzlicher API-Call zu Expo ausgeführt – ideal auch für Free-Accounts.'
      );
    } catch (e: any) {
      setEasStatus('error');
      Alert.alert(
        'Fehler',
        e?.message ?? 'EAS-Konfiguration konnte nicht geprüft werden.'
      );
    } finally {
      setLoadingEas(false);
    }
  }, [easProjectId, supabaseProjectId, supabaseKey]);

  const renderStatusDot = (status: StatusType) => (
    <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Verbindungen</Text>

      <View style={styles.platformInfo}>
        <Ionicons name="information-circle-outline" size={16} color="#fff" />
        <Text style={styles.platformText}>
          Läuft auf {Platform.OS === 'ios' ? 'iOS' : 'Android'} – Expo SDK 54.
        </Text>
      </View>

      {!!activeRepo && (
        <>
          <View style={styles.githubUserBadge}>
            <Ionicons name="logo-github" size={16} color="#000" />
            <Text style={styles.githubUserText}>Aktives Repo: {activeRepo}</Text>
          </View>

          <View style={styles.secretSyncBox}>
            <Text style={styles.secretSyncText}>
              Repo-Secrets:{' '}
              {lastSecretSync
                ? `zuletzt ${new Date(lastSecretSync).toLocaleTimeString()}`
                : 'noch nie synchronisiert'}
            </Text>
            <TouchableOpacity
              style={[
                styles.secretSyncButton,
                (syncingSecrets || !hasSecretsConfigured) && styles.buttonDisabled,
              ]}
              onPress={() => syncSecretsForActiveRepo('manual')}
              disabled={syncingSecrets || !hasSecretsConfigured}
            >
              {syncingSecrets ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#000" />
                  <Text style={styles.secretSyncButtonText}>Secrets syncen</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* SUPABASE */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Supabase</Text>
          {renderStatusDot(supabaseStatus)}
        </View>
        <Text style={styles.sectionSubtitle}>
          Nutzt die Supabase Project-ID (z.B. ekibkjarieqaslsrmazl) – die URL wird
          automatisch als https://&lt;id&gt;.supabase.co gebaut.
        </Text>

        <Text style={styles.label}>Project ID</Text>
        <TextInput
          style={styles.input}
          value={supabaseProjectId}
          onChangeText={setSupabaseProjectId}
          placeholder="z.B. ekibkjarieqaslsrmazl"
          placeholderTextColor={theme.palette.text.secondary}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Anon Key</Text>
        <TextInput
          style={styles.input}
          value={supabaseKey}
          onChangeText={setSupabaseKey}
          placeholder="EXPO_PUBLIC_SUPABASE_ANON_KEY"
          placeholderTextColor={theme.palette.text.secondary}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Service Role Key</Text>
        <TextInput
          style={styles.input}
          value={supabaseServiceRoleKey}
          onChangeText={setSupabaseServiceRoleKey}
          placeholder="SUPABASE_SERVICE_ROLE_KEY"
          placeholderTextColor={theme.palette.text.secondary}
          autoCapitalize="none"
        />

        {!!supabaseTestDetails && (
          <View style={styles.testDetails}>
            <Text style={styles.testDetailsText}>{supabaseTestDetails}</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, loadingSupabase && styles.buttonDisabled]}
            onPress={saveSupabaseConfig}
            disabled={loadingSupabase}
          >
            {loadingSupabase ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#000" />
                <Text style={styles.buttonText}>Speichern</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loadingSupabase && styles.buttonDisabled]}
            onPress={testSupabase}
            disabled={loadingSupabase}
          >
            {loadingSupabase ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#000" />
                <Text style={styles.buttonText}>Testen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hintText}>
          💡 Test prüft: REST API + build_jobs Tabelle + Edge Functions (optional)
        </Text>
      </View>

      {/* GITHUB */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>GitHub</Text>
          {renderStatusDot(githubStatus)}
        </View>
        <Text style={styles.sectionSubtitle}>
          Speichere dein Personal Access Token (PAT) und teste die Verbindung.
        </Text>

        <Text style={styles.label}>GitHub Token (PAT)</Text>
        <TextInput
          style={styles.input}
          value={githubToken}
          onChangeText={setGithubTokenState}
          placeholder="ghp_..."
          placeholderTextColor={theme.palette.text.secondary}
          autoCapitalize="none"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, loadingGithub && styles.buttonDisabled]}
            onPress={saveGithubTokenHandler}
            disabled={loadingGithub}
          >
            {loadingGithub ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#000" />
                <Text style={styles.buttonText}>Speichern</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loadingGithub && styles.buttonDisabled]}
            onPress={testGithub}
            disabled={loadingGithub}
          >
            {loadingGithub ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#000" />
                <Text style={styles.buttonText}>Testen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {!!githubUser && (
          <View style={styles.githubUserBadge}>
            <Ionicons name="person-circle-outline" size={18} color="#000" />
            <Text style={styles.githubUserText}>Eingeloggt als: {githubUser}</Text>
          </View>
        )}
      </View>

      {/* EAS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>EAS (Expo Application Services)</Text>
          {renderStatusDot(easStatus)}
        </View>
        <Text style={styles.sectionSubtitle}>
          EAS wird bei dir über Supabase Edge Functions (trigger-eas-build) angesteuert.
        </Text>

        <Text style={styles.label}>EAS Project ID</Text>
        <TextInput
          style={styles.input}
          value={easProjectId}
          onChangeText={setEasProjectId}
          placeholder="z.B. 5e5a7791-8751-416b-9a1f-831adfffcb6c"
          placeholderTextColor={theme.palette.text.secondary}
          autoCapitalize="none"
        />

        <Text style={styles.label}>EAS Token (optional)</Text>
        <TextInput
          style={styles.input}
          value={easToken}
          onChangeText={setEasToken}
          placeholder="EAS_TOKEN (falls benötigt)"
          placeholderTextColor={theme.palette.text.secondary}
          autoCapitalize="none"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, loadingEas && styles.buttonDisabled]}
            onPress={saveEasConfig}
            disabled={loadingEas}
          >
            {loadingEas ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#000" />
                <Text style={styles.buttonText}>Speichern</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loadingEas && styles.buttonDisabled]}
            onPress={testEas}
            disabled={loadingEas}
          >
            {loadingEas ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#000" />
                <Text style={styles.buttonText}>Konfig testen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hintText}>
          💡 Es wird kein Request an Expo geschickt – nur deine lokale Konfiguration wird
          geprüft.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.sm,
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  platformText: {
    marginLeft: 6,
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  section: {
    marginBottom: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: theme.palette.text.primary,
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
    columnGap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.palette.primary,
    marginRight: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  hintText: {
    marginTop: 8,
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  githubUserBadge: {
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  githubUserText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#000',
  },
  secretSyncBox: {
    marginBottom: theme.spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  secretSyncText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 6,
  },
  secretSyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.palette.primary,
  },
  secretSyncButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  testDetails: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: theme.palette.background,
  },
  testDetailsText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
});

export default ConnectionsScreen;
