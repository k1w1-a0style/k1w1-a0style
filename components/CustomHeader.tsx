import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {

  const handlePlayPress = () => { Alert.alert("Info", "Expo Go Start aktuell nicht unterstützt."); };
  const handleStopPress = () => { Alert.alert("Info", "Expo Stop aktuell nicht unterstützt."); };

  return (
    // SafeAreaView für Notch etc., aber ohne extra Padding unten
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
          <Ionicons name="menu-outline" size={30} color={theme.palette.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{options.title || 'k1w1-a0style'}</Text>
        <View style={styles.iconsContainer}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="cloud-upload-outline" size={24} color={theme.palette.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handlePlayPress}>
            <Ionicons name="play-outline" size={24} color={theme.palette.text.primary} />
          </TouchableOpacity>
           <TouchableOpacity style={styles.iconButton} onPress={handleStopPress}>
            <Ionicons name="stop-circle-outline" size={24} color={theme.palette.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.palette.card, // Header-Hintergrund
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.palette.card,
    paddingHorizontal: 15,
    height: 55, // Höhe leicht reduziert
    // Kein vertikales Padding mehr hier
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconsContainer: {
    flexDirection: 'row',
  },
  menuButton: {
    paddingRight: 15,
     paddingVertical: 5, // Kleines Padding für Klickbereich
  },
  iconButton: {
    marginLeft: 16,
    padding: 5, // Kleines Padding für Klickbereich
  },
});

export default CustomHeader;
