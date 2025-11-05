// screens/ConnectionsScreen.tsx (V10 - PUSH/PULL REPARIERT)

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSupabaseClient } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';
// WICHTIG: Importiere die korrigierten Context-Funktionen
import { useProject, getGitHubToken, getExpoToken, saveGitHubToken, saveExpoToken } from '../contexts/ProjectContext';
import { Buffer } from 'buffer';

// Secure token keys
// (Werden jetzt aus dem Context importiert)

// AsyncStorage Keys
const SUPABASE_URL_KEY = 'supabase_url';
const SUPABASE_ANON_KEY = 'supabase_key';
const GITHUB_REPO_KEY = 'github_repo_key';

const ConnectionsScreen = () => {
  const { projectData, updateProjectFiles } = useProject();

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [easToken, setEasToken] = useState('');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isTestingGitHub, setIsTestingGitHub] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [githubStatus, setGithubStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [githubUsername, setGithubUsername] = useState<string | null>(null);

  // === LOAD TOKENS ===
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const [sUrl, sKey, ghRepo] = await Promise.all([
          AsyncStorage.getItem(SUPABASE_URL_KEY),
          AsyncStorage.getItem(SUPABASE_ANON_KEY),
          AsyncStorage.getItem(GITHUB_REPO_KEY),
        ]);

        // Verwende die Context-Helfer
        const [ghToken, eToken] = await Promise.all([
           getGitHubToken(),
           getExpoToken()
        ]);

        if (sUrl) setSupabaseUrl(sUrl);
        if (sKey) setSupabaseAnonKey(sKey);
        if (ghRepo) setGithubRepo(ghRepo);
        if (ghToken) setGithubToken(ghToken);
        if (eToken) setEasToken(eToken);
      } catch (e) {
        console.error('Fehler beim Laden der Tokens:', e);
       }
    };
    loadTokens();
  }, []);

  // === SAVE HANDLERS ===
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
    if (!githubRepo.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Repo-Namen ein (z.B. owner/repo).');
      return;
    }
    try {
      // Verwende die Context-Helfer
      await saveGitHubToken(githubToken.trim());
      await AsyncStorage.setItem(GITHUB_REPO_KEY, githubRepo.trim());
      Alert.alert('Gespeichert', 'GitHub Token & Repo wurden gespeichert.');
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
      // Verwende die Context-Helfer
      await saveExpoToken(easToken.trim());
      Alert.alert('Gespeichert', 'Expo Access Token wurde sicher gespeichert.');
    } catch (e) {
      Alert.alert('Fehler', 'Konnte nicht speichern.');
    }
  };

  // === TEST HANDLERS ===
  const handleTestSupabase = async () => {
    // (Unverändert)
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
          throw new Error("Edge Function 'test' nicht gefunden (404).");
        }
        throw new Error(`Edge Function Fehler: ${error.message}`);
      }
      if (data?.status === 'ok') {
        setSupabaseStatus('success');
        Alert.alert('Erfolg', 'Supabase Function ist erreichbar!');
      } else {
        throw new Error('Unerwartete Antwort.');
      }
    } catch (e: any) {
      setSupabaseStatus('error');
      Alert.alert('Fehler', e.message || 'Supabase Test fehlgeschlagen.');
    } finally {
      setIsTestingSupabase(false);
    }
  };
  
  const handleTestGitHub = async () => {
    // (Unverändert)
    setIsTestingGitHub(true);
    setGithubStatus('idle');
    setGithubUsername(null);
    try {
      const token = githubToken.trim();
      if (!token) throw new Error('Bitte gib zuerst einen GitHub Token ein.');
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Ungültiger Token oder fehlende Berechtigung");
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
  
  // === 🚀 PUSH TO GITHUB (OHNE BUILD) ===
  const handlePushToGitHub = async () => {
    // (Unverändert)
    if (!githubToken.trim() || !githubRepo.trim()) {
      Alert.alert('Fehler', 'GitHub Token und Repo müssen konfiguriert sein.');
      return;
    }
    if (!projectData || !projectData.files || projectData.files.length === 0) {
      Alert.alert('Fehler', 'Keine Dateien zum Pushen vorhanden.');
      return;
    }
    setIsPushing(true);
    try {
      const [owner, repo] = githubRepo.split('/');
      if (!owner || !repo) {
        throw new Error('Repo-Format ungültig. Erwarte: owner/repo');
      }
      const token = githubToken.trim();
      const files = projectData.files;
      const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
      for (const file of sortedFiles) {
        if (!file.path) continue;
        console.log(`Pushing ${file.path}...`);
        const getResp = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`,
          { headers: { Authorization: `token ${token}` } }
        );
        let sha: string | undefined = undefined;
        if (getResp.ok) {
          const existing = await getResp.json();
          sha = existing.sha;
        }
        const body: any = {
          message: `Update ${file.path}`,
          content: Buffer.from(file.content, 'utf8').toString('base64'),
          branch: 'main',
        };
        if (sha) body.sha = sha;
        const putResp = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `token ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
          }
        );
        const json = await putResp.json();
        if (!putResp.ok) {
          throw new Error(`Push failed für ${file.path}: ${json.message || 'Unknown error'}`);
        }
      }
      Alert.alert(
        '✅ Push erfolgreich',
        `${sortedFiles.length} Dateien wurden zu ${owner}/${repo} gepusht.`
      );
    } catch (e: any) {
      console.error('Push error:', e);
      Alert.alert('Push Fehler', e.message || String(e));
    } finally {
      setIsPushing(false);
    }
  };

  // === 🔽 PULL FROM GITHUB ===
  const handlePullFromGitHub = async () => {
    // (Unverändert, bis auf den updateProjectFiles-Aufruf)
    if (!githubToken.trim() || !githubRepo.trim()) {
      Alert.alert('Fehler', 'GitHub Token und Repo müssen konfiguriert sein.');
      return;
    }
    Alert.alert(
      'Pull von GitHub',
      'WARNUNG: Dies überschreibt dein lokales Projekt mit dem Code aus GitHub. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ja, pullen',
          style: 'destructive',
          onPress: async () => {
            setIsPulling(true);
            try {
              const [owner, repo] = githubRepo.split('/');
              if (!owner || !repo) throw new Error('Repo-Format ungültig');
              const token = githubToken.trim();
              const treeResp = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
                { headers: { Authorization: `token ${token}` } }
              );
              if (!treeResp.ok) {
                throw new Error(`GitHub API Error: ${treeResp.status}`);
              }
              const treeData = await treeResp.json();
              const files = treeData.tree.filter((item: any) => item.type === 'blob');
              if (files.length === 0) {
                throw new Error('Keine Dateien im Repo gefunden.');
              }
              const pulledFiles = await Promise.all(
                files.map(async (file: any) => {
                  const contentResp = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
                    { headers: { Authorization: `token ${token}` } }
                  );
                  const contentData = await contentResp.json();
                  const content = Buffer.from(contentData.content, 'base64').toString('utf8');
                  return {
                    path: file.path,
                    content,
                  };
                })
              );
              
              // === KORREKTUR HIER ===
              // Verwendet die 1-Argument-Version von updateProjectFiles
              await updateProjectFiles(pulledFiles, `${owner}/${repo}`); 
              // ======================
              
              Alert.alert(
                '✅ Pull erfolgreich',
                `${pulledFiles.length} Dateien von ${owner}/${repo} geladen.`
              );
            } catch (e: any) {
              console.error('Pull error:', e);
              Alert.alert('Pull Fehler', e.message || String(e));
            } finally {
              setIsPulling(false);
            }
          }
        }
      ]
    );
  };

  // === STATUS ICON ===
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
            placeholder="Supabase URL"
            placeholderTextColor={theme.palette.text.secondary}
            value={supabaseUrl}
            onChangeText={setSupabaseUrl}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Supabase Anon Key"
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

        {/* GitHub Sektion MIT PUSH/PULL */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. GitHub (Code Sync)</Text>
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
          />
          <TextInput
            style={styles.input}
            placeholder="GitHub Repo (z.B. username/my-repo)"
            placeholderTextColor={theme.palette.text.secondary}
            value={githubRepo}
            onChangeText={setGithubRepo}
            autoCapitalize="none"
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
              {isTestingGitHub ? <ActivityIndicator size="small" color={theme.palette.primary} /> : <Text style={styles.buttonTextSecondary}>Testen</Text>}
            </TouchableOpacity>
          </View>

          {/* 🚀 PUSH/PULL BUTTONS */}
          <View style={styles.syncSection}>
            <Text style={styles.syncTitle}>Code Synchronisation</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSuccess, (!githubToken || !githubRepo) && styles.buttonDisabled]}
                onPress={handlePushToGitHub}
                disabled={isPushing || !githubToken || !githubRepo}
              >
                {isPushing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={[styles.buttonText, { marginLeft: 8 }]}>Push</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonWarning, (!githubToken || !githubRepo) && styles.buttonDisabled]}
                onPress={handlePullFromGitHub}
                disabled={isPulling || !githubToken || !githubRepo}
              >
                {isPulling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-download-outline" size={18} color="#fff" />
                    <Text style={[styles.buttonText, { marginLeft: 8 }]}>Pull</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
              Push: Code lokal → GitHub{'\n'}
              Pull: GitHub → lokal (überschreibt!)
            </Text>
          </View>
        </View>

        {/* EAS Sektion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Expo EAS (für Builds)</Text>
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

// === STYLES ===
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  section: {
    marginBottom: 24,
    backgroundColor: theme.palette.card,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.palette.text.primary
  },
  usernameBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.background,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.success
  },
  usernameText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.palette.success,
    fontWeight: 'bold'
  },
  input: {
    backgroundColor: theme.palette.input.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: theme.palette.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 10
  },
  hintText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    marginTop: 8,
    paddingHorizontal: 4
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  buttonPrimary: { backgroundColor: theme.palette.primary },
  buttonSecondary: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.primary
  },
  buttonSuccess: { backgroundColor: '#10b981' }, // Grün
  buttonWarning: { backgroundColor: '#f59e0b' }, // Gelb
  buttonDisabled: { backgroundColor: theme.palette.text.disabled }, // Grau
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff' // Weiße Schrift für farbige Buttons
  },
  buttonTextSecondary: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.palette.primary
  },
  syncSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 12
  }
});

export default ConnectionsScreen;

