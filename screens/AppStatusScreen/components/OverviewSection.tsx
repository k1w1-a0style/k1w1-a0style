import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../../theme';
import { styles } from '../styles';
import type { BuildConfig, ProjectStats } from '../types';
import type { ProjectData } from '../../../shared/types/project';

type Props = {
  buildConfig: BuildConfig | null;
  projectStats: ProjectStats | null;
  projectData: Pick<ProjectData, 'lastModified'>;
};

export function OverviewSection({ buildConfig, projectStats, projectData }: Props) {
  return (
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
          <Text style={styles.checklistText}>Expo Config vorhanden (app.json / app.config.*)</Text>
        </View>
        <View style={styles.checklistItem}>
          <Ionicons
            name={projectStats?.hasAppTsx ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={projectStats?.hasAppTsx ? theme.palette.success : theme.palette.error}
          />
          <Text style={styles.checklistText}>Entry-Point vorhanden (package.json main / App.*)</Text>
        </View>
      </View>
    </View>
  );
}
