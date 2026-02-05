import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../../theme';
import { styles } from '../styles';

type Props = {
  onExport: () => void;
};

export function AppStatusHeader({ onExport }: Props) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>📊 App Status</Text>
      <TouchableOpacity style={styles.exportButton} onPress={onExport}>
        <Ionicons name="download-outline" size={20} color={theme.palette.primary} />
        <Text style={styles.exportButtonText}>Export</Text>
      </TouchableOpacity>
    </View>
  );
}
