// screens/ConnectionsScreen.tsx (MIGRIERT ZU SECURESTORE & TEXT KORRIGIERT)

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSupabaseClient } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';

// Secure token keys (Müssen mit ProjectContext.tsx übereinstimmen)
const GH_TOKEN_KEY = 'github_pat_v1';
const EXPO_TOKEN_KEY = 'expo_token_v1';

// AsyncStorage Keys (Nur noch für nicht-sensible Daten oder Supabase)
const SUPABASE_URL_KEY = 'supabase_url';
const SUPABASE_ANON_KEY = 'supabase_key';
const GITHUB_REPO_KEY = 'github_repo_key'; // Bleibt in AsyncStorage, da nicht geheim

const ConnectionsScreen = () => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubRepo, setGithubRepo] = useState(''); // State für das Ziel-Repo
  const [easToken, setEasToken] = useState('');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isTestingGitHub, setIsTestingGitHub] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [githubStatus, setGithubStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [githubUsername, setGithubUsername] = useState<string | null>(null);

  // Lade-Funktion (ANGEPASST auf SecureStore)
  useEffect(() => {
    const loadTokens = async () => {
      try {
        // Lade Supabase & Repo-Name aus AsyncStorage
        const [sUrl, sKey, ghRepo] = await Promise.all([
          AsyncStorage.getItem(SUPABASE_URL_KEY),
          AsyncStorage.getItem(SUPABASE_ANON_KEY),
          AsyncStorage.getItem(GITHUB_REPO_KEY),
        ]);
        
        // NEU: Lade sensible Tokens aus SecureStore
        const [ghToken, eToken] = await Promise.all([
            SecureStore.getItemAsync(GH_TOKEN_KEY),
            SecureStore.getItemAsync(EXPO_TOKEN_KEY)
        ]);

        if (sUrl) setSupabaseUrl(sUrl);
        if (sKey) setSupabaseAnonKey(sKey);
        if (ghRepo) setGithubRepo(ghRepo);
        
        // Setze Tokens aus SecureStore
        if (ghToken) setGithubToken(ghToken);
        if (eToken) setEasToken(eToken);

      } catch (e) {
        console.error('Fehler beim Laden der Tokens:', e);
      }
    };
    loadTokens();
  }, []);

  // Speicher-Funktionen
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
    // Speichert Token in SecureStore
    if (!githubToken.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen GitHub Token ein.');
      return;
    }
    try {
      // NEU: SecureStore
      await SecureStore.setItemAsync(GH_TOKEN_KEY, githubToken.trim(), {
          keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
      });
      // Repo-Feld wird nicht mehr gespeichert, da es automatisch generiert wird
      Alert.alert('Gespeichert', 'GitHub Token (sicher) wurde gespeichert.');
    } catch (e) {
      Alert.alert('Fehler', 'Konnte nicht speichern.');
    }
  };

  const handleSaveEAS = async () => {
    // NEU: Speichert in SecureStore
    if (!easToken.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Expo Access Token ein.');
      return;
    }
    try {
      // NEU: SecureStore
      await SecureStore.setItemAsync(EXPO_TOKEN_KEY, easToken.trim(), {
          keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
      });
      Alert.alert('Gespeichert', 'Expo Access Token wurde sicher gespeichert.');
    } catch (e) {
      Alert.alert('Fehler', 'Konnte nicht speichern.');
    }
  };

  // Test-Funktionen
  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseStatus('idle');
    try {
      const client = await ensureSupabaseClient();
      // @ts-ignore
      if (!client || client.functions.invoke.toString().includes('DUMMY_CLIENT')) {
        throw new Error('Supabase Client nicht bereit.');
      }
      const { data, error } = await client.functions.invoke('test');
      if (error) {
        if ((error as any).context?.status === 404) {
          throw new Error("Edge Function 'test' nicht gefunden (404). Hast du 'npx supabase functions deploy' auf dem Ziel-Projekt ausgeführt?");
        }
        throw new Error(`Edge Function Fehler (500): ${error.message}`);
      }
      if (data?.status === 'ok') {
        setSupabaseStatus('success');
        Alert.alert('Erfolg', 'Supabase Function ist erreichbar!');
      } else {
        throw new Error('Unerwartete Antwort von der Test-Funktion.');
      }
    } catch (e: any) {
      setSupabaseStatus('error');
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
      const token = githubToken.trim();
      if (!token) throw new Error('Bitte gib zuerst einen GitHub Token ein.');
      const response = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("GitHub API Error: 401 (Ungültiger Token oder fehlende 'user' Berechtigung)");
        }
        throw new Error(`GitHub API Error: ${response.status}`);
      }
      const userData = await response.json();
      setGithubStatus('success');
      setGithubUsername(userData.login);
      Alert.alert('Erfolg', `Verbunden als: ${userData.login}`);
    } catch (e: any) {
      setGithubStatus('error');
      setGithubUsername(null);
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
        
        {/* Supabase Sektion */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. Supabase (für KI-Chat)</Text>
            {getStatusIcon(supabaseStatus)}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Supabase URL (z.B. https://....supabase.co)"
            placeholderTextColor={theme.palette.text.secondary}
            value={supabaseUrl}
            onChangeText={setSupabaseUrl}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Supabase Anon Key (der öffentliche Key)"
            placeholderTextColor={theme.palette.text.secondary}
            value={supabaseAnonKey}
            onChangeText={setSupabaseAnonKey}
            secureTextEntry
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
              {isTestingSupabase ? <ActivityIndicator size="small" color={theme.palette.primary} /> : <Text style={styles.buttonTextSecondary}>Testen</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* GitHub Sektion (KORRIGIERT) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. GitHub (für EAS Build)</Text>
            {getStatusIcon(githubStatus)}
          </View>
          {githubUsername && (
            <View style={styles.usernameBanner}>
              <Ionicons name="person-circle" size={20} color={theme.palette.success} />
              <Text style={styles.usernameText}>Token gültig (User: {githubUsername})</Text>
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="GitHub Personal Access Token (mit repo, workflow scope)"
            placeholderTextColor={theme.palette.text.secondary}
            value={githubToken}
            onChangeText={setGithubToken}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="GitHub Repository (wird automatisch erstellt)"
            placeholderTextColor={theme.palette.text.secondary}
            value={githubRepo}
            onChangeText={setGithubRepo}
            autoCapitalize="none"
            editable={false}
            selectTextOnFocus={false}
          />
          <Text style={styles.hintText}>Repo-Name wird automatisch beim ersten Build erstellt (z.B. projekt-name-1234abcd)</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleSaveGitHub}>
              <Text style={styles.buttonText}>Token speichern</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleTestGitHub}
              disabled={isTestingGitHub}
            >
              {isTestingGitHub ? <ActivityIndicator size="small" color={theme.palette.primary} /> : <Text style={styles.buttonTextSecondary}>Token testen</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* EAS Sektion (KORRIGIERT) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Expo EAS Konto (für EAS Build)</Text>
          <TextInput
            style={styles.input}
            placeholder="Expo Access Token"
            placeholderTextColor={theme.palette.text.secondary}
            value={easToken}
            onChangeText={setEasToken}
            secureTextEntry
          />
          <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleSaveEAS}>
            <Text style={styles.buttonText}>Token speichern</Text>
          </TouchableOpacity>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24, backgroundColor: theme.palette.card, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.palette.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.palette.text.primary },
  usernameBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.background, padding: 10, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: theme.palette.success },
  usernameText: { marginLeft: 8, fontSize: 14, color: theme.palette.success, fontWeight: 'bold' },
  input: { backgroundColor: theme.palette.input.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, color: theme.palette.text.primary, fontSize: 14, borderWidth: 1, borderColor: theme.palette.border, marginBottom: 10 },
  hintText: { fontSize: 12, color: theme.palette.text.secondary, fontStyle: 'italic', marginBottom: 10, marginTop: -5, paddingHorizontal: 4 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: theme.palette.primary },
  buttonSecondary: { backgroundColor: theme.palette.card, borderWidth: 1, borderColor: theme.palette.primary },
  buttonText: { fontSize: 14, fontWeight: 'bold', color: theme.palette.background },
  buttonTextSecondary: { fontSize: 14, fontWeight: 'bold', color: theme.palette.primary },
});

export default ConnectionsScreen;

