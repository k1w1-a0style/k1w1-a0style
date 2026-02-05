import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../../theme';
import { styles } from '../styles';
import type { SectionType } from '../types';

type Props = {
  activeSection: SectionType;
  onChangeSection: (section: SectionType) => void;
};

export function AppStatusTabs({ activeSection, onChangeSection }: Props) {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeSection === 'overview' && styles.tabActive]}
        onPress={() => onChangeSection('overview')}
      >
        <Ionicons
          name="stats-chart"
          size={18}
          color={
            activeSection === 'overview'
              ? theme.palette.primary
              : theme.palette.text.secondary
          }
        />
        <Text style={[styles.tabText, activeSection === 'overview' && styles.tabTextActive]}>
          Übersicht
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeSection === 'config' && styles.tabActive]}
        onPress={() => onChangeSection('config')}
      >
        <Ionicons
          name="settings-outline"
          size={18}
          color={
            activeSection === 'config'
              ? theme.palette.primary
              : theme.palette.text.secondary
          }
        />
        <Text style={[styles.tabText, activeSection === 'config' && styles.tabTextActive]}>
          Config
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeSection === 'dependencies' && styles.tabActive]}
        onPress={() => onChangeSection('dependencies')}
      >
        <Ionicons
          name="cube-outline"
          size={18}
          color={
            activeSection === 'dependencies'
              ? theme.palette.primary
              : theme.palette.text.secondary
          }
        />
        <Text
          style={[
            styles.tabText,
            activeSection === 'dependencies' && styles.tabTextActive,
          ]}
        >
          Deps
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeSection === 'files' && styles.tabActive]}
        onPress={() => onChangeSection('files')}
      >
        <Ionicons
          name="folder-outline"
          size={18}
          color={
            activeSection === 'files'
              ? theme.palette.primary
              : theme.palette.text.secondary
          }
        />
        <Text style={[styles.tabText, activeSection === 'files' && styles.tabTextActive]}>
          Dateien
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeSection === 'validation' && styles.tabActive]}
        onPress={() => onChangeSection('validation')}
      >
        <Ionicons
          name="checkmark-circle-outline"
          size={18}
          color={
            activeSection === 'validation'
              ? theme.palette.primary
              : theme.palette.text.secondary
          }
        />
        <Text
          style={[
            styles.tabText,
            activeSection === 'validation' && styles.tabTextActive,
          ]}
        >
          Check
        </Text>
      </TouchableOpacity>
    </View>
  );
}
