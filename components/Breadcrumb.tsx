import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ currentPath, onNavigate }) => {
  if (!currentPath) return null;

  const parts = currentPath.split('/');

  return (
    <View style={styles.breadcrumb}>
      <TouchableOpacity onPress={() => onNavigate('')} style={styles.breadcrumbItem}>
        <Ionicons name="home-outline" size={16} color={theme.palette.primary} />
        <Text style={styles.breadcrumbText}>Root</Text>
      </TouchableOpacity>

      {parts.map((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        return (
          <View key={path} style={styles.breadcrumbItem}>
            <Ionicons name="chevron-forward" size={14} color={theme.palette.text.secondary} />
            <TouchableOpacity onPress={() => onNavigate(path)}>
              <Text style={styles.breadcrumbText}>{part}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.palette.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
});

