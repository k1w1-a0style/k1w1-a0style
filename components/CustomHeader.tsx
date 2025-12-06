import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, HEADER_HEIGHT } from '../theme';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProject } from '../contexts/ProjectContext';

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const [isWorking, setIsWorking] = useState(false);
  const { projectData, exportProjectAsZip, importProjectFromZip } = useProject();

  const title = (options.title as string) || projectData?.name || 'k1w1-a0style';

  const handleExport = async () => {
    if (!projectData) return;
    try {
      setIsWorking(true);
      await exportProjectAsZip();
    } catch (error: any) {
      Alert.alert('Export-Fehler', error?.message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleImport = async () => {
    try {
      setIsWorking(true);
      await importProjectFromZip();
    } catch (error: any) {
      console.log('Import abgebrochen oder fehlgeschlagen', error);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* LEFT: Menu + Title */}
        <View style={styles.left}>
          <TouchableOpacity
            onPress={navigation.toggleDrawer}
            style={styles.iconButton}
          >
            <Ionicons name="menu-outline" size={24} color={theme.palette.text.primary} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitleText} numberOfLines={1}>
              Prompt → Code → GitHub → Build
            </Text>
          </View>
        </View>

        {/* RIGHT: Actions */}
        <View style={styles.right}>
          {/* GitHub Nav */}
          <TouchableOpacity
            onPress={() => navigation.navigate('GitHubRepos' as never)}
            style={styles.iconButton}
          >
            <Ionicons name="logo-github" size={22} color={theme.palette.text.primary} />
          </TouchableOpacity>

          {/* Build Nav */}
          <TouchableOpacity
            onPress={() => navigation.navigate('BuildsV2' as never)}
            style={styles.iconButton}
          >
            <Ionicons name="rocket-outline" size={22} color={theme.palette.primary} />
          </TouchableOpacity>

          {/* Import ZIP */}
          <TouchableOpacity
            onPress={handleImport}
            style={styles.iconButton}
            disabled={isWorking}
          >
            <Ionicons name="cloud-upload-outline" size={22} color={theme.palette.text.secondary} />
          </TouchableOpacity>

          {/* Export ZIP */}
          <TouchableOpacity
            onPress={handleExport}
            style={styles.iconButton}
            disabled={isWorking}
          >
            {isWorking ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <Ionicons name="download-outline" size={22} color={theme.palette.text.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CustomHeader;

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.palette.card },
  container: {
    height: HEADER_HEIGHT,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  titleContainer: { marginLeft: 8, flexShrink: 1 },
  titleText: { fontSize: 16, fontWeight: '600', color: theme.palette.text.primary },
  subtitleText: { marginTop: 2, fontSize: 11, color: theme.palette.text.secondary },
  right: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 4, padding: 8, borderRadius: 999 },
});
