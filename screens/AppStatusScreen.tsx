// screens/AppStatusScreen.tsx – App Status & Pre-Build Validation
// (umbenannt von PreviewScreen - zeigt Projektstatus, NICHT echte Preview)
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useProject } from '../contexts/ProjectContext';
import { theme } from '../theme';

type SectionType = 'overview' | 'config' | 'dependencies' | 'files' | 'validation';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface BuildConfig {
  appName: string;
  packageName: string;
  version: string;
  expoVersion: string;
  sdkVersion: string;
  owner: string;
}

interface ProjectStats {
  totalFiles: number;
  totalLines: number;
  dependencies: number;
  devDependencies: number;
  hasAppConfig: boolean;
  hasPackageJson: boolean;
  hasAppTsx: boolean;
}

const AppStatusScreen: React.FC = () => {
  const { projectData, isLoading, exportProjectAsZip } = useProject();
  const [activeSection, setActiveSection] = useState<SectionType>('overview');

  // Parse project data
  const { buildConfig, projectStats, validationIssues, dependencies, fileTree } = useMemo(() => {
    if (!projectData) {
      return {
        buildConfig: null,
        projectStats: null,
        validationIssues: [],
        dependencies: [],
        fileTree: [],
      };
    }

    const files = projectData.files || [];
    const issues: ValidationIssue[] = [];

    // Parse package.json
    const pkgFile = files.find(f => f.path === 'package.json');
    let pkgData: any = null;
    let pkgName = projectData.name || 'Unknown Project';
    let pkgVersion = '1.0.0';
    let deps: any = {};
    let devDeps: any = {};

    if (pkgFile) {
      try {
        pkgData = JSON.parse(String(pkgFile.content));
        pkgName = pkgData.name || pkgName;
        pkgVersion = pkgData.version || pkgVersion;
        deps = pkgData.dependencies || {};
        devDeps = pkgData.devDependencies || {};
      } catch (error) {
        issues.push({
          type: 'error',
          message: 'package.json ist fehlerhaft',
          details: 'JSON Parse Fehler',
        });
      }
    } else {
      issues.push({
        type: 'error',
        message: 'package.json fehlt',
        details: 'Diese Datei ist zwingend erforderlich',
      });
    }

    // Parse app.config.js
    const appConfigFile = files.find(f => f.path === 'app.config.js');
    let appName = pkgName;
    let packageName = '';
    let owner = '';
    let expoVersion = '';
    let sdkVersion = '';

    if (appConfigFile) {
      try {
        const content = String(appConfigFile.content);
        // Extract values using regex (simple parsing)
        const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
        const packageMatch = content.match(/package:\s*["']([^"']+)["']/);
        const ownerMatch = content.match(/owner:\s*["']([^"']+)["']/);
        
        if (nameMatch) appName = nameMatch[1];
        if (packageMatch) packageName = packageMatch[1];
        if (ownerMatch) owner = ownerMatch[1];

        if (!packageName) {
          issues.push({
            type: 'error',
            message: 'Android Package Name fehlt',
            details: 'android.package muss in app.config.js definiert sein',
          });
        }
      } catch (error) {
        issues.push({
          type: 'warning',
          message: 'app.config.js konnte nicht gelesen werden',
        });
      }
    } else {
      issues.push({
        type: 'error',
        message: 'app.config.js fehlt',
        details: 'Diese Datei ist für den Build erforderlich',
      });
    }

    // Check for App.tsx
    const appTsxFile = files.find(f => f.path === 'App.tsx');
    if (!appTsxFile) {
      issues.push({
        type: 'error',
        message: 'App.tsx fehlt',
        details: 'Entry-Point der App fehlt',
      });
    }

    // Check for required dependencies
    if (pkgData) {
      const requiredDeps = ['expo', 'react', 'react-native'];
      requiredDeps.forEach(dep => {
        if (!deps[dep]) {
          issues.push({
            type: 'error',
            message: `Fehlende Dependency: ${dep}`,
            details: 'Diese Dependency ist erforderlich',
          });
        }
      });

      if (deps['expo']) {
        expoVersion = deps['expo'];
        // Extract SDK version from expo version
        const versionMatch = expoVersion.match(/~?(\d+)\./);
        if (versionMatch) {
          sdkVersion = `SDK ${versionMatch[1]}`;
        }
      }
    }

    // Calculate statistics
    const totalLines = files.reduce((sum, f) => {
      return sum + String(f.content).split('\n').length;
    }, 0);

    // Build config object
    const config: BuildConfig = {
      appName,
      packageName: packageName || projectData.packageName || 'nicht gesetzt',
      version: pkgVersion,
      expoVersion,
      sdkVersion: sdkVersion || 'Unknown',
      owner: owner || 'nicht gesetzt',
    };

    // Project statistics
    const stats: ProjectStats = {
      totalFiles: files.length,
      totalLines,
      dependencies: Object.keys(deps).length,
      devDependencies: Object.keys(devDeps).length,
      hasAppConfig: !!appConfigFile,
      hasPackageJson: !!pkgFile,
      hasAppTsx: !!appTsxFile,
    };

    // Dependencies list
    const dependenciesList = Object.entries(deps).map(([name, version]) => ({
      name,
      version: String(version),
    }));

    // File tree (group by directory)
    const fileGroups: { [key: string]: string[] } = {};
    files.forEach(file => {
      const parts = file.path.split('/');
      const dir = parts.length > 1 ? parts[0] : 'root';
      if (!fileGroups[dir]) fileGroups[dir] = [];
      fileGroups[dir].push(file.path);
    });

    // Add info messages
    if (issues.length === 0) {
      issues.push({
        type: 'info',
        message: '✓ Projekt ist bereit für den Build',
        details: 'Alle Validierungen erfolgreich',
      });
    }

    return {
      buildConfig: config,
      projectStats: stats,
      validationIssues: issues,
      dependencies: dependenciesList,
      fileTree: Object.entries(fileGroups),
    };
  }, [projectData]);

  const handleExport = useCallback(() => {
    Alert.alert(
      'Projekt exportieren',
      'Möchten Sie das Projekt als ZIP-Datei exportieren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Exportieren',
          onPress: () => exportProjectAsZip(),
        },
      ]
    );
  }, [exportProjectAsZip]);

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 App Status</Text>
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="download-outline" size={20} color={theme.palette.primary} />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Section Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'overview' && styles.tabActive]}
          onPress={() => setActiveSection('overview')}
        >
          <Ionicons
            name="stats-chart"
            size={18}
            color={activeSection === 'overview' ? theme.palette.primary : theme.palette.text.secondary}
          />
          <Text style={[styles.tabText, activeSection === 'overview' && styles.tabTextActive]}>
            Übersicht
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeSection === 'config' && styles.tabActive]}
          onPress={() => setActiveSection('config')}
        >
          <Ionicons
            name="settings-outline"
            size={18}
            color={activeSection === 'config' ? theme.palette.primary : theme.palette.text.secondary}
          />
          <Text style={[styles.tabText, activeSection === 'config' && styles.tabTextActive]}>
            Config
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeSection === 'dependencies' && styles.tabActive]}
          onPress={() => setActiveSection('dependencies')}
        >
          <Ionicons
            name="cube-outline"
            size={18}
            color={activeSection === 'dependencies' ? theme.palette.primary : theme.palette.text.secondary}
          />
          <Text style={[styles.tabText, activeSection === 'dependencies' && styles.tabTextActive]}>
            Deps
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeSection === 'files' && styles.tabActive]}
          onPress={() => setActiveSection('files')}
        >
          <Ionicons
            name="folder-outline"
            size={18}
            color={activeSection === 'files' ? theme.palette.primary : theme.palette.text.secondary}
          />
          <Text style={[styles.tabText, activeSection === 'files' && styles.tabTextActive]}>
            Dateien
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeSection === 'validation' && styles.tabActive]}
          onPress={() => setActiveSection('validation')}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={activeSection === 'validation' ? theme.palette.primary : theme.palette.text.secondary}
          />
          <Text style={[styles.tabText, activeSection === 'validation' && styles.tabTextActive]}>
            Check
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Projekt-Übersicht</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="documents" size={32} color={theme.palette.primary} />
                <Text style={styles.statNumber}>{projectStats?.totalFiles || 0}</Text>
                <Text style={styles.statLabel}>Dateien</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="code-slash" size={32} color={theme.palette.primary} />
                <Text style={styles.statNumber}>{projectStats?.totalLines || 0}</Text>
                <Text style={styles.statLabel}>Zeilen Code</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="cube" size={32} color={theme.palette.primary} />
                <Text style={styles.statNumber}>{projectStats?.dependencies || 0}</Text>
                <Text style={styles.statLabel}>Dependencies</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="construct" size={32} color={theme.palette.primary} />
                <Text style={styles.statNumber}>{projectStats?.devDependencies || 0}</Text>
                <Text style={styles.statLabel}>Dev Deps</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle" size={20} color={theme.palette.primary} />
                <Text style={styles.cardTitle}>Projekt-Info</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name:</Text>
                <Text style={styles.infoValue}>{buildConfig?.appName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Version:</Text>
                <Text style={styles.infoValue}>{buildConfig?.version}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>SDK:</Text>
                <Text style={styles.infoValue}>{buildConfig?.sdkVersion}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Zuletzt geändert:</Text>
                <Text style={styles.infoValue}>
                  {projectData.lastModified
                    ? new Date(projectData.lastModified).toLocaleString('de-DE')
                    : 'Unbekannt'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="checkmark-done" size={20} color={theme.palette.success} />
                <Text style={styles.cardTitle}>Build-Bereitschaft</Text>
              </View>
              <View style={styles.checklistItem}>
                <Ionicons
                  name={projectStats?.hasPackageJson ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={projectStats?.hasPackageJson ? theme.palette.success : theme.palette.error}
                />
                <Text style={styles.checklistText}>package.json vorhanden</Text>
              </View>
              <View style={styles.checklistItem}>
                <Ionicons
                  name={projectStats?.hasAppConfig ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={projectStats?.hasAppConfig ? theme.palette.success : theme.palette.error}
                />
                <Text style={styles.checklistText}>app.config.js vorhanden</Text>
              </View>
              <View style={styles.checklistItem}>
                <Ionicons
                  name={projectStats?.hasAppTsx ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={projectStats?.hasAppTsx ? theme.palette.success : theme.palette.error}
                />
                <Text style={styles.checklistText}>App.tsx vorhanden</Text>
              </View>
            </View>
          </View>
        )}

        {/* Config Section */}
        {activeSection === 'config' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Build-Konfiguration</Text>
            
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="phone-portrait" size={20} color={theme.palette.primary} />
                <Text style={styles.cardTitle}>App-Identität</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>App Name:</Text>
                <Text style={styles.infoValue}>{buildConfig?.appName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Package Name:</Text>
                <Text style={styles.infoValue}>{buildConfig?.packageName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Version:</Text>
                <Text style={styles.infoValue}>{buildConfig?.version}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner:</Text>
                <Text style={styles.infoValue}>{buildConfig?.owner}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="rocket" size={20} color={theme.palette.primary} />
                <Text style={styles.cardTitle}>Expo Konfiguration</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Expo Version:</Text>
                <Text style={styles.infoValue}>{buildConfig?.expoVersion}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>SDK Version:</Text>
                <Text style={styles.infoValue}>{buildConfig?.sdkVersion}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={18} color={theme.palette.warning} />
              <Text style={styles.infoCardText}>
                Diese Werte werden beim Build verwendet. Stellen Sie sicher, dass Package Name und Version korrekt sind.
              </Text>
            </View>
          </View>
        )}

        {/* Dependencies Section */}
        {activeSection === 'dependencies' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Dependencies</Text>
            
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="cube" size={20} color={theme.palette.primary} />
                <Text style={styles.cardTitle}>
                  Installierte Pakete ({dependencies.length})
                </Text>
              </View>
              {dependencies.length === 0 ? (
                <Text style={styles.emptyText}>Keine Dependencies gefunden</Text>
              ) : (
                dependencies.map((dep, index) => (
                  <View key={index} style={styles.depItem}>
                    <View style={styles.depDot} />
                    <View style={styles.depContent}>
                      <Text style={styles.depName}>{dep.name}</Text>
                      <Text style={styles.depVersion}>{dep.version}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="bulb" size={18} color={theme.palette.warning} />
              <Text style={styles.infoCardText}>
                Stellen Sie sicher, dass alle Dependencies kompatibel mit Ihrer Expo SDK Version sind.
              </Text>
            </View>
          </View>
        )}

        {/* Files Section */}
        {activeSection === 'files' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📁 Dateistruktur</Text>
            
            {fileTree.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>Keine Dateien im Projekt</Text>
              </View>
            ) : (
              fileTree.map(([dir, files], index) => (
                <View key={index} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="folder" size={20} color={theme.palette.primary} />
                    <Text style={styles.cardTitle}>
                      {dir} ({files.length})
                    </Text>
                  </View>
                  {files.map((file, fileIndex) => (
                    <View key={fileIndex} style={styles.fileItem}>
                      <Ionicons
                        name="document"
                        size={14}
                        color={theme.palette.text.secondary}
                      />
                      <Text style={styles.fileName}>{file}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        {/* Validation Section */}
        {activeSection === 'validation' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✓ Build-Validierung</Text>
            
            {validationIssues.map((issue, index) => (
              <View
                key={index}
                style={[
                  styles.validationCard,
                  issue.type === 'error' && styles.validationCardError,
                  issue.type === 'warning' && styles.validationCardWarning,
                  issue.type === 'info' && styles.validationCardInfo,
                ]}
              >
                <View style={styles.validationHeader}>
                  <Ionicons
                    name={
                      issue.type === 'error'
                        ? 'close-circle'
                        : issue.type === 'warning'
                        ? 'warning'
                        : 'checkmark-circle'
                    }
                    size={22}
                    color={
                      issue.type === 'error'
                        ? theme.palette.error
                        : issue.type === 'warning'
                        ? theme.palette.warning
                        : theme.palette.success
                    }
                  />
                  <Text
                    style={[
                      styles.validationMessage,
                      issue.type === 'error' && styles.validationMessageError,
                      issue.type === 'warning' && styles.validationMessageWarning,
                      issue.type === 'info' && styles.validationMessageInfo,
                    ]}
                  >
                    {issue.message}
                  </Text>
                </View>
                {issue.details && (
                  <Text style={styles.validationDetails}>{issue.details}</Text>
                )}
              </View>
            ))}

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={18} color={theme.palette.primary} />
              <Text style={styles.infoCardText}>
                Beheben Sie alle Fehler bevor Sie einen Build starten. Warnungen sind optional, sollten aber überprüft werden.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  exportButtonText: {
    color: theme.palette.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
    fontSize: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.error,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.palette.primary,
  },
  tabText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.palette.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border + '30',
  },
  infoLabel: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: theme.palette.text.primary,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checklistText: {
    fontSize: 14,
    color: theme.palette.text.primary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.warning + '40',
    padding: 12,
    marginBottom: 16,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.text.secondary,
    lineHeight: 18,
  },
  depItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border + '20',
  },
  depDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.primary,
  },
  depContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  depName: {
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: '500',
  },
  depVersion: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  fileName: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  validationCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 12,
  },
  validationCardError: {
    borderLeftColor: theme.palette.error,
    borderColor: theme.palette.error + '40',
  },
  validationCardWarning: {
    borderLeftColor: theme.palette.warning,
    borderColor: theme.palette.warning + '40',
  },
  validationCardInfo: {
    borderLeftColor: theme.palette.success,
    borderColor: theme.palette.success + '40',
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  validationMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  validationMessageError: {
    color: theme.palette.error,
  },
  validationMessageWarning: {
    color: theme.palette.warning,
  },
  validationMessageInfo: {
    color: theme.palette.success,
  },
  validationDetails: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 6,
    marginLeft: 32,
    lineHeight: 18,
  },
});

export default AppStatusScreen;
