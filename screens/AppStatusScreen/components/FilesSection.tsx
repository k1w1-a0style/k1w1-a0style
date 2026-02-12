import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { styles } from '../styles';
import type { FileTree } from '../types';

type Props = {
  fileTree: FileTree;
  totalDirs?: number;
  fileCountsByDir?: Record<string, number>;
};

export function FilesSection({ fileTree, totalDirs, fileCountsByDir }: Props) {
  const hiddenDirs = Math.max(0, (totalDirs ?? fileTree.length) - fileTree.length);

  return (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionSubtitle}>Projektstruktur</Text>

      <ScrollView style={styles.fileTree} showsVerticalScrollIndicator={false}>
        {fileTree.map(([dir, files]) => {
          const totalFiles = fileCountsByDir?.[dir] ?? files.length;
          const hiddenFiles = Math.max(0, totalFiles - files.length);

          return (
            <View key={dir} style={styles.card}>
              <Text style={styles.cardTitle}>{dir}</Text>

              <View style={styles.fileList}>
                {files.map(file => (
                  <Text key={`${dir}/${file}`} style={styles.fileItem}>
                    • {file}
                  </Text>
                ))}
              </View>

              {hiddenFiles > 0 && (
                <Text style={styles.fileStats}>… +{hiddenFiles} weitere Dateien</Text>
              )}
            </View>
          );
        })}

        {hiddenDirs > 0 && <Text style={styles.fileStats}>… +{hiddenDirs} weitere Ordner</Text>}
      </ScrollView>
    </View>
  );
}
