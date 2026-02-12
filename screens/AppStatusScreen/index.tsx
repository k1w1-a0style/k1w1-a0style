// screens/AppStatusScreen.tsx – App Status & Pre-Build Validation
// (umbenannt von PreviewScreen - zeigt Projektstatus, NICHT echte Preview)
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme';
import { AppStatusHeader } from './components/AppStatusHeader';
import { AppStatusTabs } from './components/AppStatusTabs';
import { ConfigSection } from './components/ConfigSection';
import { DependenciesSection } from './components/DependenciesSection';
import { FilesSection } from './components/FilesSection';
import { OverviewSection } from './components/OverviewSection';
import { ValidationSection } from './components/ValidationSection';
import { useAppStatusScreen } from './hooks/useAppStatusScreen';
import { styles } from './styles';

const AppStatusScreen: React.FC = () => {
  const {
    projectData,
    isLoading,
    activeSection,
    setActiveSection,
    buildConfig,
    projectStats,
    validationIssues,
    dependencies,
    dependenciesTotal,
    fileTree,
    fileDirsTotal,
    fileTreeCounts,
    handleExport,
  } = useAppStatusScreen();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={styles.loadingText}>Projekt wird geladen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!projectData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.palette.error} />
          <Text style={styles.errorText}>Kein Projekt geladen</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <AppStatusHeader onExport={handleExport} />

      {/* Section Tabs */}
      <AppStatusTabs activeSection={activeSection} onChangeSection={setActiveSection} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <OverviewSection
            buildConfig={buildConfig}
            projectStats={projectStats}
            projectData={projectData}
          />
        )}

        {/* Config Section */}
        {activeSection === 'config' && (
          <ConfigSection buildConfig={buildConfig} />
        )}

        {/* Dependencies Section */}
        {activeSection === 'dependencies' && (
          <DependenciesSection dependencies={dependencies} totalCount={dependenciesTotal} />
        )}

        {/* Files Section */}
        {activeSection === 'files' && (
          <FilesSection fileTree={fileTree} totalDirs={fileDirsTotal} fileCountsByDir={fileTreeCounts} />
        )}

        {/* Validation Section */}
        {activeSection === 'validation' && (
          <ValidationSection validationIssues={validationIssues} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AppStatusScreen;
