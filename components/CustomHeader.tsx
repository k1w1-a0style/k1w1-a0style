import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme, HEADER_HEIGHT } from '../theme';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import { ensureSupabaseClient } from '../lib/supabase'; // Import Supabase Client getter
import { SafeAreaView } from 'react-native-safe-area-context'; // Ensure this is imported

const EAS_TOKEN_KEY = 'eas_token'; // Key to retrieve the token

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  // State to show loading while triggering the build
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);

  // --- Function to trigger the EAS build via Supabase ---
  const handleTriggerEasBuild = async () => {
    console.log("EAS Build Button pressed (CustomHeader)");
    setIsTriggeringBuild(true); // Start loading indicator

    try {
      // 1. Get Supabase client
      const supabase = await ensureSupabaseClient();
       // @ts-ignore Check for dummy client
       if (!supabase || supabase.functions.invoke.toString().includes('DUMMY_CLIENT')) {
           throw new Error("Supabase Client ist nicht bereit.");
       }

      // 2. Get EAS Token from AsyncStorage
      const easToken = await AsyncStorage.getItem(EAS_TOKEN_KEY);
      if (!easToken) {
        Alert.alert(
          "Fehler: Expo Token fehlt",
          "Bitte füge deinen Expo Access Token im 'Verbindungen'-Bildschirm hinzu."
        );
        // setIsTriggeringBuild(false); // Done in finally
        return; // Stop execution
      }

      console.log("Rufe Supabase Function 'trigger-eas-build' auf...");

      // 3. Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('trigger-eas-build', {
        // Make sure the body is stringified JSON
        body: JSON.stringify({ easToken: easToken }), // Send the token in the body
      });

      // 4. Handle the response
      if (error) {
        console.error("Fehler von Supabase Function:", error);
        // Try to parse error details if possible
        let detail = error.message || 'Unbekannter Supabase-Fehler';
        if (error.context?.details) {
            try {
                const parsedDetails = JSON.parse(error.context.details);
                detail = parsedDetails.error || detail;
            } catch(e) { /* Ignore if details are not JSON */ }
        }
        throw new Error(`Fehler beim Starten des Builds: ${detail}`);
      }

      // Success
      console.log("Supabase Function erfolgreich aufgerufen:", data);
      Alert.alert(
        "Build Gestartet",
        data?.message || "Der EAS Build wurde erfolgreich ausgelöst."
      );
      // Future: Navigate to terminal or show build info from data.buildInfo

    } catch (err: any) {
      console.error("Fehler in handleTriggerEasBuild:", err);
      Alert.alert("Build Fehlgeschlagen", err.message || "Ein unbekannter Fehler ist aufgetreten.");
    } finally {
      setIsTriggeringBuild(false); // Stop loading indicator
    }
  };

  // --- Placeholder functions ---
  const handleStartExpoGo = () => { Alert.alert("Expo Go", "Deaktiviert."); };
  const handleExportZip = () => { Alert.alert("Export ZIP", "Nicht implementiert."); };


  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {/* Menu Button */}
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton} disabled={isTriggeringBuild}>
          <Ionicons name="menu-outline" size={30} color={theme.palette.text.primary} />
        </TouchableOpacity>
        {/* Title */}
        <Text style={styles.title}>{options.title || 'k1w1-a0style'}</Text>
        {/* Right Icons */}
        <View style={styles.iconsContainer}>
          {/* EAS Build Button - Shows loading indicator */}
          <TouchableOpacity onPress={handleTriggerEasBuild} style={styles.iconButton} disabled={isTriggeringBuild}>
            {isTriggeringBuild ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={24} color={theme.palette.primary} />
            )}
          </TouchableOpacity>
          {/* Play Button */}
          <TouchableOpacity style={styles.iconButton} onPress={handleStartExpoGo} disabled={isTriggeringBuild}>
            <Ionicons name="play-outline" size={24} color={theme.palette.text.disabled} />
          </TouchableOpacity>
           {/* Archive/Export Button */}
           <TouchableOpacity style={styles.iconButton} onPress={handleExportZip} disabled={isTriggeringBuild}>
            <Ionicons name="archive-outline" size={22} color={theme.palette.text.disabled} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.palette.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.palette.card, paddingHorizontal: 15, height: HEADER_HEIGHT },
  title: { position: 'absolute', left: 60, right: 150, textAlign: 'center', color: theme.palette.text.primary, fontSize: 18, fontWeight: 'bold' },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { padding: 8 },
  iconButton: { marginLeft: 12, padding: 8, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }, // Fixed size for indicator alignment
});

export default CustomHeader;

