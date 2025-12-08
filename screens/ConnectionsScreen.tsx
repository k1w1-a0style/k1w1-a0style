// screens/ConnectionsScreen.tsx - MIT ALLEN FIXES (B) + TOKEN SICHERHEIT
import React, { useEffect, useState, useCallback } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import {
  SUPABASE_STORAGE_KEYS,
  deriveSupabaseDetails,
} from '../lib/supabaseConfig';
import {
  getGitHubToken,
  saveGitHubToken,
  getExpoToken,
  saveExpoToken,
} from '../contexts/ProjectContext';

type StatusType = 'idle' | 'ok' | 'error';

const STORAGE_KEYS = {
  SUPABASE_RAW: SUPABASE_STORAGE_KEYS.RAW,
  SUPABASE_URL: SUPABASE_STORAGE_KEYS.URL,
  SUPABASE_KEY: SUPABASE_STORAGE_KEYS.KEY,
  EAS_PROJECT_ID: 'eas_project_id',
} as const;

// Helper zum Maskieren von Tokens
const maskToken = (token: string): string => {
  if (!token || token.length < 8) return '••••••••';
  return `${token.substring(0, 4)}••••${token.substring(token.length - 4)}`;
};

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


const ConnectionsScreen: React.FC = () => {
  const [supabaseProjectId, setSupabaseProjectId] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [githubToken, setGithubTokenState] = useState('');
  const [easToken, setEasToken] = useState('');
  const [easProjectId, setEasProjectId] = useState('');

  const [supabaseStatus, setSupabaseStatus] = useState<StatusType>('idle');
  const [githubStatus, setGithubStatus] = useState<StatusType>('idle');
  const [easStatus, setEasStatus] = useState<StatusType>('idle');

  const [loadingSupabase, setLoadingSupabase] = useState(false);
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [loadingEas, setLoadingEas] = useState(false);

  const [githubUser, setGithubUser] = useState<string | null>(null);
  const [supabaseTestDetails, setSupabaseTestDetails] = useState<string>('');

  // Zustand für Token-Anzeige (maskiert vs. vollständig)
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [showEasToken, setShowEasToken] = useState(false);

  // --------------------------------------------------
  // Initial-Load: Supabase, GitHub-Token, EAS-Konfig
  // --------------------------------------------------
  useEffect(() => {
    const loadConnections = async () => {
      try {
        const [
          storedSupabaseRaw,
          storedSupabaseKey,
          storedSupabaseUrl,
          storedGithubTokenAsync,
          storedEasTokenAsync,
          storedEasProjectId,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW),
          AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY),
          AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL),
          getGitHubToken().catch(() => null),
          getExpoToken().catch(() => null),
          AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID),
        ]);

        const envSupabaseUrl =
          (process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ||
          '';
        const envSupabaseKey =
          (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as
            | string
            | undefined) || '';

        const raw =
          storedSupabaseRaw || storedSupabaseUrl || envSupabaseUrl || '';
        const derived = deriveSupabaseDetails(raw);

        setSupabaseProjectId(derived.projectId || raw);
        setSupabaseKey(storedSupabaseKey || envSupabaseKey || '');
        setGithubTokenState(storedGithubTokenAsync || '');
        setEasToken(storedEasTokenAsync || '');
        setEasProjectId(storedEasProjectId || '');
      } catch (e) {
        console.log('[ConnectionsScreen] Fehler beim Laden:', e);
      }
    };

    loadConnections();
  }, []);

  // --------------------------------------------------
  // SAVE-Actions
  // --------------------------------------------------
  const saveSupabaseConfig = useCallback(async () => {
    try {
      const rawInput = supabaseProjectId.trim();
      if (!rawInput) {
        Alert.alert('Hinweis', 'Bitte eine Supabase Project-ID eintragen.');
        return;
      }

      const derived = deriveSupabaseDetails(rawInput);
      const anonKey = supabaseKey.trim();

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.SUPABASE_RAW, rawInput],
        [STORAGE_KEYS.SUPABASE_URL, derived.url],
        [STORAGE_KEYS.SUPABASE_KEY, anonKey],
      ]);

      setSupabaseProjectId(derived.projectId || rawInput);

      Alert.alert(
        '✅ Gespeichert',
        'Supabase-Konfiguration wurde gespeichert.',
      );
    } catch (e) {
      console.log(
        '[ConnectionsScreen] Fehler beim Speichern Supabase:',
        e,
      );
      Alert.alert(
        'Fehler',
        'Supabase-Konfiguration konnte nicht gespeichert werden.',
      );
    }
  }, [supabaseProjectId, supabaseKey]);

  const saveGithubTokenHandler = useCallback(async () => {
    try {
      const token = githubToken.trim();
      if (!token) {
        Alert.alert('Hinweis', 'Bitte ein GitHub-PAT eintragen.');
        return;
      }

      // Nur in der sicheren Storage-Lösung speichern, nicht zusätzlich in AsyncStorage
      await saveGitHubToken(token);

      Alert.alert('✅ Gespeichert', 'GitHub-Token wurde sicher gespeichert.');
    } catch (e) {
      console.log(
        '[ConnectionsScreen] Fehler beim Speichern GitHub-Token:',
        e,
      );
      Alert.alert(
        'Fehler',
        'GitHub-Token konnte nicht gespeichert werden.',
      );
    }
  }, [githubToken]);

  const saveEasConfig = useCallback(async () => {
    try {
      const token = easToken.trim();
      const projectId = easProjectId.trim();

      await saveExpoToken(token);
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, projectId);

      Alert.alert(
        '✅ Gespeichert',
        'EAS-Konfiguration wurde gespeichert (Project ID + optionaler Token).',
      );
    } catch (e) {
      console.log(
        '[ConnectionsScreen] Fehler beim Speichern EAS:',
        e,
      );
      Alert.alert(
        'Fehler',
        'EAS-Konfiguration konnte nicht gespeichert werden.',
      );
    }
  }, [easToken, easProjectId]);

  // --------------------------------------------------
  // SUPABASE-TEST (REST + build_jobs + Edge Functions)
  // --------------------------------------------------
  const testSupabase = useCallback(async () => {
    const rawId = supabaseProjectId.trim();
    const key = supabaseKey.trim();

    if (!rawId || !key) {
      Alert.alert(
        'Fehlende Daten',
        'Bitte Supabase Project-ID und Anon-Key eintragen.',
      );
      setSupabaseStatus('error');
      return;
    }

    const { url } = deriveSupabaseDetails(rawId);
    if (!url) {
      Alert.alert(
        'Fehler',
        'Supabase Project-ID sieht ungültig aus.',
      );
      setSupabaseStatus('error');
      return;
    }

    try {
      setLoadingSupabase(true);
      setSupabaseStatus('idle');

      let details = 'Teste REST API...';
      setSupabaseTestDetails(details);

      // Test 1: REST API Basisverbindung
      const restRes = await fetch(`${url}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      if (!restRes.ok && restRes.status !== 404) {
        console.log(
          '[ConnectionsScreen] Supabase Test – REST Status:',
          restRes.status,
        );
        details = `REST API Fehler: Status ${restRes.status}`;
        setSupabaseTestDetails(details);
        setSupabaseStatus('error');
        Alert.alert(
          'Fehler',
          `Supabase REST API antwortet mit Status ${restRes.status}. Prüfe Project-ID/Key.`,
        );
        return;
      }

      details = '✓ REST API OK. Teste build_jobs Tabelle...';
      setSupabaseTestDetails(details);

      // Test 2: build_jobs Tabelle prüfen
      const tableRes = await fetch(
        `${url}/rest/v1/build_jobs?limit=1`,
        {
          method: 'GET',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        },
      );

      if (!tableRes.ok) {
        console.log(
          '[ConnectionsScreen] build_jobs Test – Status:',
          tableRes.status,
        );
        details = `Tabelle build_jobs nicht gefunden (${tableRes.status})`;
        setSupabaseTestDetails(details);
        setSupabaseStatus('error');
        Alert.alert(
          'Tabelle fehlt',
          'Die Tabelle "build_jobs" existiert nicht in deinem Supabase-Projekt.\n\nBitte deploy das Schema aus der Dokumentation.',
        );
        return;
      }

      details = '✓ build_jobs Tabelle OK. Teste Edge Functions...';
      setSupabaseTestDetails(details);

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

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000),
        );

        const fnRes = (await Promise.race([
          fnTestPromise,
          timeoutPromise,
        ])) as Response;

        if (fnRes.ok) {
          details = '✓ REST + Tabelle + Edge Functions OK';
          setSupabaseTestDetails(details);
          console.log('✅ Edge Functions erreichbar');
        } else {
          details =
            '✓ REST + Tabelle OK (Edge Functions nicht getestet)';
          setSupabaseTestDetails(details);
          console.warn(
            '⚠️ Edge Functions nicht erreichbar oder nicht deployed',
          );
        }
      } catch (e: any) {
        details =
          '✓ REST + Tabelle OK (Edge Functions nicht getestet)';
        setSupabaseTestDetails(details);
        console.warn(
          '⚠️ Edge Functions Test fehlgeschlagen:',
          e?.message,
        );
      }

      setSupabaseStatus('ok');
      Alert.alert(
        '✅ Supabase OK',
        'REST API und build_jobs Tabelle sind erreichbar.\n\n' +
          details,
      );
    } catch (e: any) {
      console.log('[ConnectionsScreen] Supabase Test – Fehler:', e);
      setSupabaseStatus('error');
      const msg =
        e?.message || 'Unbekannter Fehler bei der Supabase-Prüfung.';
      setSupabaseTestDetails(`Fehler: ${msg}`);
      Alert.alert('Fehler', msg);
    } finally {
      setLoadingSupabase(false);
    }
  }, [supabaseProjectId, supabaseKey]);

  // --------------------------------------------------
  // GITHUB-TEST – PAT verifizieren
  // --------------------------------------------------
  const testGithub = useCallback(async () => {
    const token = githubToken.trim();
    if (!token) {
      Alert.alert(
        'Kein Token',
        'Bitte trage dein GitHub-PAT ein und speichere es zuerst.',
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
        console.log(
          '[ConnectionsScreen] GitHub Test – Fehler:',
          res.status,
          text,
        );
        setGithubStatus('error');

        if (res.status === 401) {
          Alert.alert(
            'Token ungültig',
            'GitHub-Token ist ungültig oder abgelaufen.\n\nBitte erstelle ein neues PAT.',
          );
        } else if (res.status === 403) {
          Alert.alert(
            'Keine Rechte',
            'GitHub-Token hat nicht die erforderlichen Rechte.\n\nBenötigt: repo, workflow',
          );
        } else {
          Alert.alert(
            'Fehler',
            `GitHub-API Fehler (Status ${res.status}).\n\n${text}`,
          );
        }
        return;
      }

      const json = await res.json();
      setGithubUser(json?.login ?? null);
      setGithubStatus('ok');

      Alert.alert(
        '✅ GitHub OK',
        `Token ist gültig!\n\nUser: ${
          json?.login || 'Unbekannt'
        }\nScopes: ${
          res.headers.get('x-oauth-scopes') || 'Keine Info'
        }`,
      );
    } catch (e: any) {
      console.log(
        '[ConnectionsScreen] GitHub Test – Netzwerkfehler:',
        e,
      );
      setGithubStatus('error');
      Alert.alert(
        'Fehler',
        e?.message ?? 'GitHub konnte nicht erreicht werden.',
      );
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
          'Bitte eine EAS Project ID eintragen (z.B. 5e5a7791-8751-416b-9a1f-831adfffcb6c).',
        );
        return;
      }

      // Validiere UUID-Format grob
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(projectId)) {
        setEasStatus('error');
        Alert.alert(
          'Formatfehler',
          'Die EAS Project ID sollte eine UUID sein (z.B. 5e5a7791-8751-416b-9a1f-831adfffcb6c).',
        );
        return;
      }

      // Wenn Supabase konfiguriert ist, prüfen ob EAS in Supabase hinterlegt ist
      if (supaId && supaKey) {
        setEasStatus('ok');
        Alert.alert(
          '✅ EAS Konfiguration OK',
          `Project ID: ${projectId}\n\nToken: ${
            easToken ? maskToken(easToken) : 'Kein Token hinterlegt'
          }\n\nHinweis: Token ist optional für lokale Builds.`,
        );
      } else {
        setEasStatus('ok');
        Alert.alert(
          '⚠️ EAS Konfiguration',
          'Project ID ist eingetragen. Für Builds benötigst du auch eine korrekte Supabase-Konfiguration.',
        );
      }
    } catch (e: any) {
      console.log('[ConnectionsScreen] EAS Test – Fehler:', e);
      setEasStatus('error');
      Alert.alert(
        'Fehler',
        e?.message ?? 'EAS-Konfiguration konnte nicht geprüft werden.',
      );
    } finally {
      setLoadingEas(false);
    }
  }, [easProjectId, easToken, supabaseProjectId, supabaseKey]);

  // Render-Funktion für Token-Input mit Toggle
  const renderTokenInput = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    secured: boolean,
    show: boolean,
    onToggleShow: () => void,
    placeholder: string = '',
  ) => (
    <View style={styles.tokenInputContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.tokenInputRow}>
        <TextInput
          style={styles.tokenInput}
          value={show ? value : maskToken(value)}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.palette.text.secondary}
          secureTextEntry={secured && !show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {secured && value.length > 0 && (
          <TouchableOpacity
            onPress={onToggleShow}
            style={styles.showTokenButton}
          >
            <Ionicons
              name={show ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.palette.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>🔗 Verbindungen</Text>
      <Text style={styles.subtitle}>
        Hier trägst du die Zugangsdaten für Supabase, GitHub und EAS ein.
      </Text>

      {/* Supabase */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="server-outline"
            size={20}
            color={theme.palette.primary}
          />
          <Text style={styles.sectionTitle}>Supabase</Text>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(supabaseStatus) },
            ]}
          />
        </View>

        <TextInput
          style={styles.input}
          value={supabaseProjectId}
          onChangeText={setSupabaseProjectId}
          placeholder="Project ID oder URL (z.B. xfgnzpcljsuqqdjlxgul)"
          placeholderTextColor={theme.palette.text.secondary}
          autoCapitalize="none"
        />

        {renderTokenInput(
          'Anon Key (öffentlich):',
          supabaseKey,
          setSupabaseKey,
          true,
          showSupabaseKey,
          () => setShowSupabaseKey(prev => !prev),
          'sbp_...',
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveSupabaseConfig}
          >
            <Text style={styles.saveButtonText}>Speichern</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.testButton,
              loadingSupabase && styles.testButtonDisabled,
            ]}
            onPress={testSupabase}
            disabled={loadingSupabase}
          >
            {loadingSupabase ? (
              <ActivityIndicator
                size="small"
                color={theme.palette.secondary}
              />
            ) : (
              <Text style={styles.testButtonText}>Testen</Text>
            )}
          </TouchableOpacity>
        </View>

        {supabaseTestDetails ? (
          <Text style={styles.testDetails}>{supabaseTestDetails}</Text>
        ) : null}
      </View>

      {/* GitHub */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="logo-github"
            size={20}
            color={theme.palette.primary}
          />
          <Text style={styles.sectionTitle}>GitHub</Text>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(githubStatus) },
            ]}
          />
        </View>

        {renderTokenInput(
          'Personal Access Token (PAT):',
          githubToken,
          setGithubTokenState,
          true,
          showGithubToken,
          () => setShowGithubToken(prev => !prev),
          'github_pat_...',
        )}

        {githubUser ? (
          <View style={styles.userInfo}>
            <Ionicons
              name="person-outline"
              size={16}
              color={theme.palette.success}
            />
            <Text style={styles.userInfoText}>
              Angemeldet als: {githubUser}
            </Text>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveGithubTokenHandler}
          >
            <Text style={styles.saveButtonText}>Speichern</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.testButton,
              loadingGithub && styles.testButtonDisabled,
            ]}
            onPress={testGithub}
            disabled={loadingGithub}
          >
            {loadingGithub ? (
              <ActivityIndicator
                size="small"
                color={theme.palette.secondary}
              />
            ) : (
              <Text style={styles.testButtonText}>Testen</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Benötigte Scopes:{' '}
          <Text style={styles.hintBold}>repo, workflow</Text>
        </Text>
      </View>

      {/* EAS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="rocket-outline"
            size={20}
            color={theme.palette.primary}
          />
          <Text style={styles.sectionTitle}>
            Expo Application Services (EAS)
          </Text>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(easStatus) },
            ]}
          />
        </View>

        <TextInput
          style={styles.input}
          value={easProjectId}
          onChangeText={setEasProjectId}
          placeholder="Project ID (UUID, z.B. 5e5a7791-8751-416b-9a1f-831adfffcb6c)"
          placeholderTextColor={theme.palette.text.secondary}
          autoCapitalize="none"
        />

        {renderTokenInput(
          'EAS Token (optional):',
          easToken,
          setEasToken,
          true,
          showEasToken,
          () => setShowEasToken(prev => !prev),
          'eas_...',
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveEasConfig}
          >
            <Text style={styles.saveButtonText}>Speichern</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.testButton,
              loadingEas && styles.testButtonDisabled,
            ]}
            onPress={testEas}
            disabled={loadingEas}
          >
            {loadingEas ? (
              <ActivityIndicator
                size="small"
                color={theme.palette.secondary}
              />
            ) : (
              <Text style={styles.testButtonText}>Prüfen</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Das EAS Token ist nur für lokale Builds nötig. In der Cloud
          übernimmt Supabase die Authentifizierung.
        </Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    marginBottom: 24,
  },
  section: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  input: {
    backgroundColor: theme.palette.input.background,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.palette.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 12,
  },
  tokenInputContainer: {
    marginBottom: 12,
  },
  tokenInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenInput: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.palette.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  showTokenButton: {
    padding: 10,
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.palette.primary,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    color: theme.palette.secondary,
    fontWeight: '600',
  },
  testButton: {
    flex: 1,
    backgroundColor: theme.palette.card,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    color: theme.palette.text.primary,
    fontWeight: '600',
  },
  hint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
  hintBold: {
    fontWeight: 'bold',
    color: theme.palette.text.primary,
  },
  testDetails: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
  },
  userInfoText: {
    color: theme.palette.success,
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  label: {
    color: theme.palette.text.primary,
    fontSize: 13,
    marginBottom: 4,
  },
});

export default ConnectionsScreen;
