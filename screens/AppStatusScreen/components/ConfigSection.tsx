import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../../theme';
import { styles } from '../styles';
import type { BuildConfig } from '../types';

type Props = {
  buildConfig: BuildConfig | null;
};

export function ConfigSection({ buildConfig }: Props) {
  return (
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
  );
}
