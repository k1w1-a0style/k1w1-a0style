import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme, HEADER_HEIGHT } from '../theme';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSupabaseClient } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

const EAS_TOKEN_KEY = 'eas_token';

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleTriggerEasBuild = async () => { /* ... (unverändert) ... */ console.log("EAS Build Button gedrückt"); setIsTriggeringBuild(true); try { const supabase = await ensureSupabaseClient(); /* @ts-ignore */ if (!supabase || supabase.functions.invoke.toString().includes('DUMMY_CLIENT')) { throw new Error("Supabase Client nicht bereit."); } const easToken = await AsyncStorage.getItem(EAS_TOKEN_KEY); if (!easToken) { Alert.alert( "Fehler: Expo Token fehlt", "Bitte füge deinen Expo Access Token hinzu." ); return; } console.log("Rufe Supabase Function 'trigger-eas-build' auf..."); const { data, error } = await supabase.functions.invoke('trigger-eas-build', { body: JSON.stringify({ easToken: easToken }), }); if (error) { console.error("Fehler von Supabase Function:", error); let detail = error.message || '?'; if (error.context?.details) { try { const p = JSON.parse(error.context.details); detail = p.error || detail; } catch(e) {} } throw new Error(`Fehler beim Starten des Builds: ${detail}`); } console.log("Supabase Function erfolgreich:", data); Alert.alert( "Build Gestartet", data?.message || "Build ausgelöst." ); } catch (err: any) { console.error("Fehler in handleTriggerEasBuild:", err); Alert.alert("Build Fehlgeschlagen", err.message || "?"); } finally { setIsTriggeringBuild(false); } };
  const handleStartExpoGo = () => { Alert.alert("Expo Go", "Deaktiviert."); };
  const handleExportZip = async () => { /* ... (unverändert) ... */ console.log("Export ZIP Button gedrückt"); setIsExporting(true); try { const lastCode = await AsyncStorage.getItem(LAST_AI_RESPONSE_KEY); if (!lastCode) { throw new Error("Kein Code zum Exportieren gefunden."); } const fileName = 'letzter_code.txt'; const fileUri = FileSystem.cacheDirectory + fileName; console.log(`Schreibe Code nach: ${fileUri}`); await FileSystem.writeAsStringAsync(fileUri, lastCode, { encoding: FileSystem.EncodingType.UTF8 }); console.log("Datei geschrieben."); if (!(await Sharing.isAvailableAsync())) { throw new Error("Teilen nicht verfügbar."); } console.log(`Teile Datei: ${fileUri}`); await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Code exportieren', UTI: 'public.plain-text', }); console.log("Dialog geöffnet."); } catch (error: any) { console.error("Fehler Export:", error); Alert.alert("Export Fehlgeschlagen", error.message || "?"); } finally { setIsExporting(false); } };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton} disabled={isTriggeringBuild || isExporting}>
          <Ionicons name="menu-outline" size={30} color={theme.palette.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{options.title || 'k1w1-a0style'}</Text>
        <View style={styles.iconsContainer}>
          {/* EAS Build Button */}
          <TouchableOpacity onPress={handleTriggerEasBuild} style={styles.iconButton} disabled={isTriggeringBuild || isExporting}>
            {isTriggeringBuild ? ( <ActivityIndicator size="small" color={theme.palette.primary} /> ) : ( <Ionicons name="cloud-upload-outline" size={24} color={theme.palette.primary} /> )}
          </TouchableOpacity>
          {/* Play Button */}
          <TouchableOpacity style={styles.iconButton} onPress={handleStartExpoGo} disabled={isTriggeringBuild || isExporting}>
             {/* === FARBKORREKTUR HIER === */}
            <Ionicons name="play-outline" size={24} color={theme.palette.text.secondary} />
          </TouchableOpacity>
           {/* Export ZIP Button */}
           <TouchableOpacity style={styles.iconButton} onPress={handleExportZip} disabled={isTriggeringBuild || isExporting}>
             {isExporting ? ( <ActivityIndicator size="small" color={theme.palette.primary} /> ) : ( <Ionicons name="archive-outline" size={22} color={theme.palette.primary} /> )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.palette.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.palette.card, paddingHorizontal: 15, height: HEADER_HEIGHT },
  title: { position: 'absolute', left: 60, right: 150, textAlign: 'center', color: theme.palette.text.primary, fontSize: 18, fontWeight: 'bold' },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { padding: 8 },
  iconButton: { marginLeft: 12, padding: 8, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});

export default CustomHeader;

