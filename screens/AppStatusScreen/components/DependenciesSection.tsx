import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../../theme';
import { styles } from '../styles';
import type { DependencyItem } from '../types';

type Props = {
  dependencies: DependencyItem[];
};

export function DependenciesSection({ dependencies }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📦 Dependencies</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cube" size={20} color={theme.palette.primary} />
          <Text style={styles.cardTitle}>Installierte Pakete ({dependencies.length})</Text>
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
  );
}
