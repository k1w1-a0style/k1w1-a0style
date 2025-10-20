import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { refreshSupabaseCredentialsAndClient } from '../lib/supabase';

const SUPABASE_URL_KEY = 'supabase_url';
const SUPABASE_KEY = 'supabase_key';
const GITHUB_KEY = 'github_key';
type ConnKey = 'supabase_url' | 'supabase_key' | 'github_key';

const ConnectionsScreen = () => {
  const [vals, setVals] = useState<Record<ConnKey, string>>({ supabase_url: '', supabase_key: '', github_key: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const keysToLoad = [SUPABASE_URL_KEY, SUPABASE_KEY, GITHUB_KEY];
      const loadedData = await AsyncStorage.multiGet(keysToLoad);
      const loadedVals: any = {};
      loadedData.forEach(([key, value]) => {
        if (value !== null) {
          loadedVals[key as ConnKey] = value;
        }
      });
      setVals(prev => ({...prev, ...loadedVals}));
    } catch (e) { Alert.alert('Fehler', 'Verbindungen konnten nicht geladen werden.'); }
  };

  const save = async (k: ConnKey) => {
    try {
      await AsyncStorage.setItem(k, vals[k] || '');
      Alert.alert('Gespeichert', `${k.replace('_', ' ').toUpperCase()} gespeichert`);
      if (k === 'supabase_url' || k === 'supabase_key') {
        await refreshSupabaseCredentialsAndClient();
      }
    } catch (e) { Alert.alert('Fehler', `${k} konnte nicht gespeichert werden.`); }
  };

  const handleInputChange = (key: ConnKey, value: string) => {
    setVals(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Verbindungen</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Supabase URL</Text>
          <TextInput style={styles.input} placeholder="https://xyz.supabase.co" value={vals.supabase_url} onChangeText={t => handleInputChange('supabase_url', t)} autoCapitalize="none" />
          <TouchableOpacity style={styles.button} onPress={() => save('supabase_url')}><Text style={styles.btnTxt}>Speichern</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Supabase Anon Key</Text>
          <TextInput style={styles.input} placeholder="eyJ..." value={vals.supabase_key} onChangeText={t => handleInputChange('supabase_key', t)} secureTextEntry autoCapitalize="none" />
          <TouchableOpacity style={styles.button} onPress={() => save('supabase_key')}><Text style={styles.btnTxt}>Speichern</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>GitHub Token</Text>
          <TextInput style={styles.input} placeholder="ghp_..." value={vals.github_key} onChangeText={t => handleInputChange('github_key', t)} secureTextEntry autoCapitalize="none" />
          <TouchableOpacity style={styles.button} onPress={() => save('github_key')}><Text style={styles.btnTxt}>Speichern</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.palette.background },
    scroll: { paddingHorizontal: 15, paddingTop: 10 },
    h1: { fontSize: 22, fontWeight: 'bold', color: theme.palette.text.primary, marginTop: 10, marginBottom: 20 },
    card: { backgroundColor: theme.palette.card, borderRadius: 12, padding: 18, marginBottom: 20 },
    label: { fontSize: 18, fontWeight: '600', color: theme.palette.text.primary, marginBottom: 12 },
    input: { backgroundColor: theme.palette.input.background, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 15, color: theme.palette.text.primary, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#444' },
    button: { backgroundColor: theme.palette.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    btnTxt: { color: theme.palette.background, fontSize: 16, fontWeight: 'bold' },
});

export default ConnectionsScreen;
