import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTerminal } from '../contexts/TerminalContext';
import { theme } from '../theme';

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const { addLog } = useTerminal();

  const handlePlayPress = () => {
    console.log('>>> Play Button Pressed!'); // Debug-Meldung
    addLog('Test: Expo Go Button gedrückt!');
  };

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
          <TouchableOpacity style={styles.iconButton} onPress={handlePlayPress}>
            <Ionicons name="play-outline" size={24} color={theme.palette.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="archive-outline" size={24} color={theme.palette.text.primary} />
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
    backgroundColor: theme.palette.card, // Header-Hintergrund
    paddingHorizontal: 15,
    height: 60,
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
  },
  iconButton: {
    marginLeft: 16,
    padding: 5,
  },
});

export default CustomHeader;
