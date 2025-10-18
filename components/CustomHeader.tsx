import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'; // Alert hinzugefügt
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
// KEIN WebSocket Import mehr
import { theme } from '../theme';

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  // KEIN useWebSocket mehr

  const handlePlayPress = () => {
    // Vorläufige Meldung, da Funktion deaktiviert
    Alert.alert("Info", "Expo Go Start über App aktuell nicht unterstützt.");
    // console.log('>>> Play Button Pressed! (Funktion deaktiviert)');
  };

  const handleStopPress = () => {
     Alert.alert("Info", "Expo Stop über App aktuell nicht unterstützt.");
     // console.log('>>> Stop Button Pressed! (Funktion deaktiviert)');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
          <Ionicons name="menu-outline" size={30} color={theme.palette.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{options.title || 'k1w1-a0style'}</Text>
        <View style={styles.iconsContainer}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="cloud-upload-outline" size={24} color={theme.palette.text.primary} />
          </TouchableOpacity>
          {/* Knopf ohne WebSocket Funktion */}
          <TouchableOpacity style={styles.iconButton} onPress={handlePlayPress}>
            <Ionicons name="play-outline" size={24} color={theme.palette.text.primary} />
          </TouchableOpacity>
          {/* Stop Button ohne WebSocket Funktion */}
           <TouchableOpacity style={styles.iconButton} onPress={handleStopPress}>
            <Ionicons name="stop-circle-outline" size={24} color={theme.palette.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Styles bleiben gleich
const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.palette.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.palette.card, paddingHorizontal: 15, height: 60 },
  title: { color: theme.palette.text.primary, fontSize: 18, fontWeight: 'bold' },
  iconsContainer: { flexDirection: 'row' },
  menuButton: { paddingRight: 15 },
  iconButton: { marginLeft: 16, padding: 5 },
});

export default CustomHeader;
