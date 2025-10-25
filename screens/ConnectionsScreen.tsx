import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSupabaseClient } from '../lib/supabase';

// ✅ FIX: Storage Keys müssen mit lib/supabase.ts übereinstimmen!
const SUPABASE_URL_KEY = 'supabase_url';
const SUPABASE_ANON_KEY = 'supabase_key';
const GITHUB_TOKEN_KEY = 'github_token';
const EAS_TOKEN_KEY = 'eas_token';

const ConnectionsScreen = () => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [easToken, setEasToken] = useState('');

  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isTestingGitHub, setIsTestingGitHub] = useState(false);

  const [supabaseStatus, setSupabaseStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [githubStatus, setGithubStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [githubUsername, setGithubUsername] = useState<string | null>(null);

  React.useEffect(() => {
    const loadTokens = async () => {
      try {
        const [sUrl, sKey, ghToken, eToken] = await Promise.all([
          AsyncStorage.getItem(SUPABASE_URL_KEY),
          AsyncStorage.getItem(SUPABASE_ANON_KEY),
          AsyncStorage.getItem(GITHUB_TOKEN_KEY),
          AsyncStorage.getItem(EAS_TOKEN_KEY)
        ]);
        if (sUrl) setSupabaseUrl(sUrl);
        if (sKey) setSupabaseAnonKey(sKey);
        if (ghToken) setGithubToken(ghToken);
        if (eToken) setEasToken(eToken);
      } catch (e) {
        console.error('Fehler beim Laden der Tokens:', e);
      }
    };
    loadTokens();
  }, []);

  const handleSaveSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      Alert.alert('Fehler', 'Bitte fülle beide Felder aus.');
      return;
    }
    try {
      await AsyncStorage.setItem(SUPABASE_URL_KEY, supabaseUrl.trim());
      await AsyncStorage.setItem(SUPABASE_ANON_KEY, supabaseAnonKey.trim());
      Alert.alert('Gespeichert', 'Supabase Credentials wurden gespeichert. Bitte starte die App neu.');
    } catch (e) {
      Alert.alert('Fehler', 'Konnte nicht speichern.');
    }
  };

  const handleSaveGitHub = async () => {
    if (!githubToken.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen GitHub Token ein.');
      return;
    }
    try {
      await AsyncStorage.setItem(GITHUB_TOKEN_KEY, githubToken.trim());
      Alert.alert('Gespeichert', 'GitHub Token wurde gespeichert.');
    } catch (e) {
      Alert.alert('Fehler', 'Konnte nicht speichern.');
    }
  };

  const handleSaveEAS = async () => {
    if (!easToken.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Expo Access Token ein.');
      return;
    }
    try {
      await AsyncStorage.setItem(EAS_TOKEN_KEY, easToken.trim());
      Alert.alert('Gespeichert', 'Expo Access Token wurde gespeichert.');
    } catch (e) {
      Alert.alert('Fehler', 'Konnte nicht speichern.');
    }
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseStatus('idle');
    try {
      const client = await ensureSupabaseClient();
      // @ts-ignore
      if (!client || client.functions.invoke.toString().includes('DUMMY_CLIENT')) {
        throw new Error('Supabase Client nicht bereit.');
      }

      const { data, error } = await client.functions.invoke('k1w1-handler', {
        body: {
          provider: 'groq',
          model: 'llama-3.1-8b-instant',
          apiKey: 'test',
          message: 'ping'
        }
      });

      if (error) {
        // ✅ FIX: console.log statt console.error für erwartete Test-Fehler
        console.log('🧪 Supabase Test - Function Response:', {
          status: error.context?.status,
          message: error.message
        });

        // 404 = Function existiert nicht (KRITISCH)
        if (error.context?.status === 404) {
          throw new Error(`Edge Function 'k1w1-handler' nicht gefunden!`);
        }

        // 400/401 = Function läuft, Test-Key ungültig (ERWARTET ✅)
        if (error.context?.status === 400 || error.context?.status === 401) {
          setSupabaseStatus('success');
          console.log('✅ Supabase Test OK (Function erreichbar, Test-Key ungültig wie erwartet).');
          Alert.alert('Erfolg', 'Supabase Function ist erreichbar!');
          return;
        }

        // Andere Fehler
        throw new Error(`Edge Function Fehler (${error.context?.status || '?'}): ${error.message}`);
      }

      setSupabaseStatus('success');
      console.log('✅ Supabase Test OK.');
      Alert.alert('Erfolg', 'Supabase ist verbunden!');
    } catch (e: any) {
      setSupabaseStatus('error');
      console.error('❌ Supabase Test Fehler:', e.message);
      Alert.alert('Fehler', e.message || 'Supabase Test fehlgeschlagen.');
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleTestGitHub = async () => {
    setIsTestingGitHub(true);
    setGithubStatus('idle');
    setGithubUsername(null);
    try {
      const token = await AsyncStorage.getItem(GITHUB_TOKEN_KEY);
      if (!token) throw new Error('GitHub Token nicht gefunden.');

      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);

      const userData = await response.json();
      setGithubStatus('success');
      setGithubUsername(userData.login);
      console.log(`✅ GitHub Test OK. User: ${userData.login}`);
      Alert.alert('Erfolg', `Verbunden als: ${userData.login}`);
    } catch (e: any) {
      setGithubStatus('error');
      setGithubUsername(null);
      console.error('❌ GitHub Test Fehler:', e.message);
      Alert.alert('Fehler', e.message || 'GitHub Test fehlgeschlagen.');
    } finally {
      setIsTestingGitHub(false);
    }
  };

  const getStatusIcon = (status: 'idle' | 'success' | 'error') => {
    if (status === 'success') return <Ionicons name="checkmark-circle" size={20} color={theme.palette.success} />;
    if (status === 'error') return <Ionicons name="close-circle" size={20} color={theme.palette.error} />;
    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Supabase</Text>
            {getStatusIcon(supabaseStatus)}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Supabase URL"
            placeholderTextColor={theme.palette.text.secondary}
            value={supabaseUrl}
            onChangeText={setSupabaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Supabase Anon Key"
            placeholderTextColor={theme.palette.text.secondary}
            value={supabaseAnonKey}
            onChangeText={setSupabaseAnonKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleSaveSupabase}>
              <Text style={styles.buttonText}>Speichern</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleTestSupabase}
              disabled={isTestingSupabase}
            >
              {isTestingSupabase ? (
                <ActivityIndicator size="small" color={theme.palette.primary} />
              ) : (
                <Text style={styles.buttonTextSecondary}>Testen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>GitHub</Text>
            {getStatusIcon(githubStatus)}
          </View>
          {githubUsername && (
            <View style={styles.usernameBanner}>
              <Ionicons name="person-circle" size={20} color={theme.palette.success} />
              <Text style={styles.usernameText}>Verbunden als: {githubUsername}</Text>
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="GitHub Personal Access Token"
            placeholderTextColor={theme.palette.text.secondary}
            value={githubToken}
            onChangeText={setGithubToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleSaveGitHub}>
              <Text style={styles.buttonText}>Speichern</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleTestGitHub}
              disabled={isTestingGitHub}
            >
              {isTestingGitHub ? (
                <ActivityIndicator size="small" color={theme.palette.primary} />
              ) : (
                <Text style={styles.buttonTextSecondary}>Testen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expo EAS</Text>
          <TextInput
            style={styles.input}
            placeholder="Expo Access Token"
            placeholderTextColor={theme.palette.text.secondary}
            value={easToken}
            onChangeText={setEasToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleSaveEAS}>
            <Text style={styles.buttonText}>Speichern</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.palette.primary} />
          <Text style={styles.infoText}>
            Alle Tokens werden sicher auf deinem Gerät gespeichert und nie an Dritte weitergegeben.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.palette.text.primary },
  usernameBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.card, padding: 10, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: theme.palette.success },
  usernameText: { marginLeft: 8, fontSize: 14, color: theme.palette.success, fontWeight: 'bold' },
  input: { backgroundColor: theme.palette.input.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, color: theme.palette.text.primary, fontSize: 14, borderWidth: 1, borderColor: theme.palette.border, marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: theme.palette.primary },
  buttonSecondary: { backgroundColor: theme.palette.card, borderWidth: 1, borderColor: theme.palette.primary },
  buttonText: { fontSize: 14, fontWeight: 'bold', color: theme.palette.background },
  buttonTextSecondary: { fontSize: 14, fontWeight: 'bold', color: theme.palette.primary },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 24, padding: 12, backgroundColor: theme.palette.card, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: theme.palette.primary },
  infoText: { flex: 1, marginLeft: 10, fontSize: 13, color: theme.palette.text.secondary, lineHeight: 18 },
});

export default ConnectionsScreen;
