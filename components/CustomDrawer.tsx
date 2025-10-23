import React, { useState, useEffect } from 'react'; 
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, TextInput, ScrollView, ActivityIndicator } from 'react-native'; // ScrollView/ActivityIndicator hinzugefügt
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useProject } from '../contexts/ProjectContext';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

// *** DRAWER FÜR SINGLE-PROJECT ***

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  // === NEUER Context Hook ===
  const { projectData, clearProject, loadProjectFromZip, setProjectName, isLoading } = useProject();
  // Lokaler State für Namens-Input
  const [editingName, setEditingName] = useState('');
  // === ENDE ===

  // Wird aufgerufen, wenn der Name geändert und gespeichert wird
  const handleSaveName = async () => {
    if (editingName.trim()) {
      await setProjectName(editingName.trim());
      Alert.alert("Gespeichert", `Projektname auf "${editingName.trim()}" geändert.`);
    } else {
        if(projectData?.name) setEditingName(projectData.name);
    }
  };

   // Setzt den Input-Wert, wenn sich der Projektname im Context ändert
  useEffect(() => {
    if (projectData?.name && projectData.name !== editingName) {
      setEditingName(projectData.name);
    }
  }, [projectData?.name]); 

  const handleClearProject = () => {
    Alert.alert(
      "Projekt zurücksetzen",
      "Möchtest du das aktuelle Projekt wirklich verwerfen und ein leeres starten?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Ja, zurücksetzen",
          style: "destructive",
          onPress: async () => {
            await clearProject(); 
            console.log("SingleProjectContext: Projekt zurückgesetzt.");
            props.navigation.closeDrawer();
            // @ts-ignore
            props.navigation.navigate('Home', { screen: 'Chat' });
          },
        },
      ]
    );
  };

  const handleLoadZip = () => {
      loadProjectFromZip(); 
      props.navigation.closeDrawer();
  };

   const handleChooseIcon = () => {
       Alert.alert("TODO", "Icon-Auswahl noch nicht implementiert.");
   };


  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <DrawerContentScrollView {...props}>
        {/* Standard-Links */}
        <DrawerItemList {...props} />

        {/* --- NEUE SEKTION: Aktuelles Projekt --- */}
        <View style={styles.divider} />
        <Text style={styles.projectSectionTitle}>Aktuelles Projekt</Text>

        {/* Namens-Eingabe */}
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Projektname:</Text>
            <TextInput
                style={styles.input}
                value={editingName}
                onChangeText={setEditingName}
                placeholder="App-Name"
                placeholderTextColor={theme.palette.text.secondary}
                onEndEditing={handleSaveName}
                editable={!isLoading} 
            />
        </View>

        {/* Icon-Platzhalter */}
        <TouchableOpacity onPress={handleChooseIcon} style={styles.customItem} disabled={isLoading}>
          <Ionicons name="image-outline" size={24} color={theme.palette.text.secondary} />
          <Text style={[styles.customItemTextSecondary]}>App Icon ändern (TODO)</Text>
        </TouchableOpacity>

        {/* --- NEUE SEKTION: Aktionen --- */}
        <View style={styles.divider} />
        <Text style={styles.projectSectionTitle}>Aktionen</Text>

        {/* ZIP Laden Button */}
        <TouchableOpacity onPress={handleLoadZip} style={styles.customItem} disabled={isLoading}>
          <Ionicons name="cloud-download-outline" size={24} color={theme.palette.primary} />
          <Text style={styles.customItemText}>Projekt aus ZIP laden</Text>
        </TouchableOpacity>

        {/* Projekt zurücksetzen Button */}
        <TouchableOpacity onPress={handleClearProject} style={styles.customItem} disabled={isLoading}>
          <Ionicons name="trash-outline" size={24} color={theme.palette.error} />
          <Text style={[styles.customItemTextError]}>Aktuelles Projekt zurücksetzen</Text>
        </TouchableOpacity>

      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

// Styles für den neuen Drawer
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.card, },
  divider: { height: 1, backgroundColor: theme.palette.border, marginVertical: 15, marginHorizontal: 16, },
  customItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, },
  customItemText: { marginLeft: 15, fontSize: 14, fontWeight: 'bold', color: theme.palette.primary, },
  customItemTextSecondary: { marginLeft: 15, fontSize: 14, fontWeight: 'bold', color: theme.palette.text.secondary, },
   customItemTextError: { marginLeft: 15, fontSize: 14, fontWeight: 'bold', color: theme.palette.error, },
  projectSectionTitle: { fontSize: 12, fontWeight: 'bold', color: theme.palette.text.secondary, paddingHorizontal: 20, marginBottom: 10, textTransform: 'uppercase', },
  inputGroup: { paddingHorizontal: 20, marginBottom: 10, },
  label: { fontSize: 14, color: theme.palette.text.secondary, marginBottom: 5, },
  input: { backgroundColor: theme.palette.input.background, borderRadius: 8, padding: 10, color: theme.palette.text.primary, borderWidth: 1, borderColor: theme.palette.border, fontSize: 14, },
});

export default CustomDrawerContent;

