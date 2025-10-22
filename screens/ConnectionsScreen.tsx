import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { ensureSupabaseClient, refreshSupabaseCredentialsAndClient } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

// Keys
const SUPABASE_URL_KEY = 'supabase_url';
const SUPABASE_KEY = 'supabase_key';
const GITHUB_KEY = 'github_key';
const EAS_TOKEN_KEY = 'eas_token';
type ConnKey = 'supabase_url' | 'supabase_key' | 'github_key' | 'eas_token';
// Status can now be just 'idle' (no key), 'checking', 'connected' (key exists), 'error' (test failed)
type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'error';

const ConnectionsScreen = () => {
  const [vals, setVals] = useState<Record<ConnKey, string>>({ supabase_url: '', supabase_key: '', github_key: '', eas_token: '' });
  const [supabaseStatus, setSupabaseStatus] = useState<ConnectionStatus>('idle');
  const [githubStatus, setGithubStatus] = useState<ConnectionStatus>('idle');
  const [easStatus, setEasStatus] = useState<ConnectionStatus>('idle'); // Still used, but logic changes
  const [githubUser, setGithubUser] = useState<string | null>(null);
  // const [easUser, setEasUser] = useState<string | null>(null); // Removed - we don't fetch user anymore
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // --- Load Credentials ---
  const loadCredentials = useCallback(async () => {
    setIsInitialLoading(true);
    try {
      const keysToLoad: ConnKey[] = [SUPABASE_URL_KEY, SUPABASE_KEY, GITHUB_KEY, EAS_TOKEN_KEY];
      const loadedData = await AsyncStorage.multiGet(keysToLoad);
      const loadedVals: Partial<Record<ConnKey, string>> = {};
      loadedData.forEach(([key, value]) => {
        if (value !== null && keysToLoad.includes(key as ConnKey)) { loadedVals[key as ConnKey] = value; }
      });
      setVals({ supabase_url: loadedVals.supabase_url ?? '', supabase_key: loadedVals.supabase_key ?? '', github_key: loadedVals.github_key ?? '', eas_token: loadedVals.eas_token ?? '' });
      // Set EAS status based ONLY on token presence after loading
      setEasStatus(loadedVals.eas_token ? 'connected' : 'idle');
    } catch (e) { Alert.alert('Fehler', 'Verbindungen konnten nicht geladen werden.'); }
    finally { setIsInitialLoading(false); }
  }, []);

  useEffect(() => { loadCredentials(); }, [loadCredentials]);

  // --- Test Functions (EAS Check Removed) ---
  const checkSupabaseConnection = useCallback(async () => {
    // ... (unchanged) ...
     const currentUrl = vals.supabase_url; const currentKey = vals.supabase_key; if (!currentUrl || !currentKey) { setSupabaseStatus('idle'); return; } setSupabaseStatus('checking'); try { const client = await ensureSupabaseClient(true); /* @ts-ignore */ if (client && !client.functions.invoke.toString().includes('DUMMY_CLIENT')) { setSupabaseStatus('connected'); console.log("Supabase Test OK."); } else { throw new Error("Dummy Client."); } } catch (e: any) { console.error("Supabase Test FAIL:", e.message); setSupabaseStatus('error'); }
  }, [vals.supabase_url, vals.supabase_key]);

  const checkGithubConnection = useCallback(async () => {
    // ... (unchanged) ...
    const currentToken = vals.github_key; setGithubUser(null); if (!currentToken) { setGithubStatus('idle'); return; } setGithubStatus('checking'); try { const response = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${currentToken}`, 'Accept': 'application/vnd.github.v3+json' }}); if (response.ok) { const userData = await response.json(); setGithubStatus('connected'); setGithubUser(userData?.login || 'Unbekannt'); console.log("GitHub Test OK. User:", userData?.login); } else { const status = response.status; let msg = `GitHub API Fehler: ${status}`; if (status === 401) msg = "GitHub Token ungültig (401)"; throw new Error(msg); } } catch (e: any) { console.error("GitHub Test FAIL:", e.message); setGithubStatus('error'); }
  }, [vals.github_key]);

  // --- checkEasConnection is REMOVED ---
  // const checkEasConnection = useCallback(async () => { ... });

  // --- Effect to Test After Loading (EAS Check Removed) ---
  useEffect(() => {
    if (!isInitialLoading) {
      checkSupabaseConnection();
      checkGithubConnection();
      // No automatic EAS check here anymore
    }
  }, [isInitialLoading, checkSupabaseConnection, checkGithubConnection]); // Removed checkEasConnection

  // --- Save Function (EAS Check Removed) ---
  const save = async (k: ConnKey) => {
    try {
      const valueToSave = vals[k] || '';
      await AsyncStorage.setItem(k, valueToSave);
      Alert.alert('Gespeichert', `${k.replace('_', ' ').toUpperCase()} gespeichert`);
      if (k === SUPABASE_URL_KEY || k === SUPABASE_KEY) { await refreshSupabaseCredentialsAndClient(); checkSupabaseConnection(); }
      if (k === GITHUB_KEY) { checkGithubConnection(); }
      if (k === EAS_TOKEN_KEY) {
        // Only update the status based on presence, no API call
        setEasStatus(valueToSave ? 'connected' : 'idle');
        console.log("EAS Token gespeichert. Status auf 'connected' (falls Token vorhanden) gesetzt.");
      }
    } catch (e) { Alert.alert('Fehler', `${k} konnte nicht gespeichert werden.`); }
  };

  // --- Input Handler (unchanged) ---
  const handleInputChange = (key: ConnKey, value: string) => { setVals(prev => ({ ...prev, [key]: value })); };

  // --- Status Indicator (EAS simplified) ---
  const renderStatusIndicator = (status: ConnectionStatus, user: string | null, serviceName: 'supabase' | 'github' | 'eas') => {
    let indicator: React.ReactNode;
    // EAS only uses 'idle' or 'connected' based on token presence now
    const currentStatus = (serviceName === 'eas' && status === 'error') ? 'idle' : status; // Show error as idle for EAS for now

    switch (currentStatus) {
      case 'checking': indicator = <ActivityIndicator size="small" color={theme.palette.text.secondary} style={styles.statusIndicator} />; break;
      case 'connected': indicator = <View style={[styles.statusIndicator, styles.statusDot, styles.statusConnected]} />; break;
      case 'error': indicator = <View style={[styles.statusIndicator, styles.statusDot, styles.statusError]} />; break;
      default: indicator = <View style={[styles.statusIndicator, styles.statusDot, styles.statusIdle]} />; break;
    }
    return (
        <View style={styles.statusContainer}>
            {indicator}
            {/* Show user only for GitHub, show generic "Token Gespeichert" for EAS */}
            {currentStatus === 'connected' && serviceName === 'github' && user && ( <Text style={styles.userText}>({user})</Text> )}
            {currentStatus === 'connected' && serviceName === 'eas' && ( <Text style={styles.userText}>(Token Gespeichert)</Text> )}
        </View>
    );
  };

  if (isInitialLoading) { return ( <SafeAreaView style={styles.safeArea}><View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.palette.primary}/></View></SafeAreaView> ); }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Verbindungen</Text>

        {/* --- Expo EAS Section (Refresh Button Removed) --- */}
        <View style={styles.card}>
           <View style={styles.cardHeader}>
                <Text style={styles.label}>Expo EAS Build</Text>
                 {renderStatusIndicator(easStatus, null, 'eas')}
           </View>
           <Text style={styles.inputLabel}>Expo Access Token</Text>
          <TextInput style={styles.input} placeholder="exptk_..." value={vals.eas_token} onChangeText={t => handleInputChange('eas_token', t)} secureTextEntry autoCapitalize="none" />
           <View style={styles.buttonRow}>
               {/* Refresh button removed for EAS */}
               <TouchableOpacity style={[styles.button, { flex: 1 } ]} onPress={() => save('eas_token')}><Text style={styles.btnTxt}>Token Speichern</Text></TouchableOpacity>
           </View>
           <Text style={styles.infoText}>Wird benötigt, um Cloud-Builds über EAS anzustoßen. Status zeigt nur an, ob ein Token gespeichert ist.</Text>
        </View>

        {/* --- Supabase Section (unchanged) --- */}
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                 <Text style={styles.label}>Supabase</Text>
                 {renderStatusIndicator(supabaseStatus, null, 'supabase')}
            </View>
            <Text style={styles.inputLabel}>URL</Text>
            <TextInput style={styles.input} placeholder="https://xyz.supabase.co" value={vals.supabase_url} onChangeText={t => handleInputChange('supabase_url', t)} autoCapitalize="none" />
            <Text style={styles.inputLabel}>Anon Key</Text>
            <TextInput style={styles.input} placeholder="eyJ..." value={vals.supabase_key} onChangeText={t => handleInputChange('supabase_key', t)} secureTextEntry autoCapitalize="none" />
            <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, styles.flexButton]} onPress={() => save('supabase_url')}><Text style={styles.btnTxt}>URL Speichern</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.flexButton, styles.secondaryButton]} onPress={() => save('supabase_key')}><Text style={styles.btnTxtSecondary}>Key Speichern</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.iconButton]} onPress={checkSupabaseConnection} disabled={supabaseStatus === 'checking'}>
                    <Ionicons name="refresh-circle-outline" size={24} color={supabaseStatus === 'checking' ? theme.palette.text.secondary : theme.palette.background} />
                </TouchableOpacity>
            </View>
        </View>

        {/* --- GitHub Section (unchanged) --- */}
        <View style={styles.card}>
           <View style={styles.cardHeader}>
                <Text style={styles.label}>GitHub</Text>
                 {renderStatusIndicator(githubStatus, githubUser, 'github')}
           </View>
           <Text style={styles.inputLabel}>Personal Access Token (PAT)</Text>
          <TextInput style={styles.input} placeholder="ghp_..." value={vals.github_key} onChangeText={t => handleInputChange('github_key', t)} secureTextEntry autoCapitalize="none" />
           <View style={styles.buttonRow}>
               <TouchableOpacity style={[styles.button, styles.flexButton]} onPress={() => save('github_key')}><Text style={styles.btnTxt}>Token Speichern</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.iconButton]} onPress={checkGithubConnection} disabled={githubStatus === 'checking'}>
                   <Ionicons name="refresh-circle-outline" size={24} color={githubStatus === 'checking' ? theme.palette.text.secondary : theme.palette.background} />
               </TouchableOpacity>
           </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// Styles (removed userText margin, adjusted EAS button row)
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.palette.background }, scroll: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 30 }, h1: { fontSize: 22, fontWeight: 'bold', color: theme.palette.text.primary, marginTop: 10, marginBottom: 20 }, card: { backgroundColor: theme.palette.card, borderRadius: 12, padding: 18, marginBottom: 20 }, cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, }, label: { fontSize: 18, fontWeight: '600', color: theme.palette.text.primary, marginRight: 5 }, inputLabel: { fontSize: 14, color: theme.palette.text.secondary, marginBottom: 5, marginLeft: 2, }, input: { backgroundColor: theme.palette.input.background, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 15, color: theme.palette.text.primary, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#444' }, buttonRow: { flexDirection: 'row', marginTop: 5, }, button: { backgroundColor: theme.palette.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48 }, flexButton: { flex: 1, marginRight: 10, }, secondaryButton: { backgroundColor: theme.palette.card, borderWidth: 1, borderColor: theme.palette.primary,}, iconButton: { paddingHorizontal: 12, minWidth: 48, }, btnTxt: { color: theme.palette.background, fontSize: 16, fontWeight: 'bold' }, btnTxtSecondary: { color: theme.palette.primary, fontSize: 16, fontWeight: 'bold' }, statusContainer: { flexDirection: 'row', alignItems: 'center' }, statusIndicator: { /* marginLeft entfernt */ }, statusDot: { width: 12, height: 12, borderRadius: 6, }, statusIdle: { backgroundColor: 'grey', }, statusConnected: { backgroundColor: 'lime', }, statusError: { backgroundColor: 'red', }, userText: { marginLeft: 8, fontSize: 14, color: theme.palette.text.secondary, fontStyle: 'italic' }, infoText: { fontSize: 13, color: theme.palette.text.secondary, marginTop: 10, lineHeight: 18, }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default ConnectionsScreen;

