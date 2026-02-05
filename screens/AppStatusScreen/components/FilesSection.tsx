import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../../theme';
import { styles } from '../styles';
import type { FileTree } from '../types';

type Props = {
  fileTree: FileTree;
};

export function FilesSection({ fileTree }: Props) {
  return (
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
  );
}
