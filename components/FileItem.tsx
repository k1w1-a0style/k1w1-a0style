import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, getNeonGlow } from '../theme';
import { TreeNode } from './FileTree';

interface FileItemProps {
  node: TreeNode;
  onPress: () => void;
  onLongPress: () => void;
  isSelected?: boolean;
  selectionMode?: boolean;
}

export const FileItem: React.FC<FileItemProps> = memo(({ 
  node, 
  onPress, 
  onLongPress,
  isSelected = false,
  selectionMode = false,
}) => {
  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      // React & TypeScript
      case 'tsx': return 'logo-react';
      case 'ts': return 'code-slash';
      
      // JavaScript
      case 'jsx': return 'logo-react';
      case 'js': return 'logo-javascript';
      
      // Web
      case 'html': return 'logo-html5';
      case 'css': return 'logo-css3';
      case 'scss': case 'sass': return 'color-palette';
      
      // Data
      case 'json': return 'code-working';
      case 'xml': return 'code-slash';
      case 'yaml': case 'yml': return 'list';
      
      // Images
      case 'png': case 'jpg': case 'jpeg': return 'image';
      case 'gif': return 'film';
      case 'svg': return 'shapes';
      case 'webp': return 'image-outline';
      
      // Documents
      case 'md': return 'document-text';
      case 'txt': return 'document-outline';
      case 'pdf': return 'document';
      
      // Config
      case 'env': return 'key';
      case 'config': case 'conf': return 'settings';
      
      // Other
      case 'gitignore': return 'git-branch';
      default: return 'document-text-outline';
    }
  };

  const getFileColor = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const name = fileName.toLowerCase();
    
    // Special files
    if (name === 'package.json') return '#CB3837';
    if (name === 'tsconfig.json') return '#3178C6';
    if (name.includes('readme')) return '#0366D6';
    if (name.includes('.env')) return '#ECD53F';
    
    switch (ext) {
      // React & TypeScript
      case 'tsx': return '#61DAFB';
      case 'ts': return '#3178C6';
      
      // JavaScript
      case 'jsx': return '#61DAFB';
      case 'js': return '#F7DF1E';
      
      // Web
      case 'html': return '#E34F26';
      case 'css': return '#1572B6';
      case 'scss': case 'sass': return '#CC6699';
      
      // Data
      case 'json': return '#FFB000';
      case 'xml': return '#FF6600';
      case 'yaml': case 'yml': return '#CB171E';
      
      // Images
      case 'png': case 'jpg': case 'jpeg': return '#4CAF50';
      case 'gif': return '#FF6D00';
      case 'svg': return '#FFB13B';
      case 'webp': return '#67C52A';
      
      // Documents
      case 'md': return '#0366D6';
      case 'txt': return '#607D8B';
      case 'pdf': return '#D32F2F';
      
      // Config
      case 'env': return '#ECD53F';
      case 'config': case 'conf': return '#795548';
      
      default: return theme.palette.text.secondary;
    }
  };

  const getFolderIcon = (): string => {
    const name = node.name.toLowerCase();
    if (name === 'components') return 'extension-puzzle';
    if (name === 'screens') return 'phone-portrait';
    if (name === 'utils' || name === 'lib') return 'build';
    if (name === 'assets' || name === 'images') return 'images';
    if (name === 'tests' || name.includes('test')) return 'flask';
    if (name === 'contexts') return 'layers';
    if (name === 'hooks') return 'git-branch';
    if (name === 'config') return 'settings';
    if (name.startsWith('.')) return 'eye-off';
    return 'folder';
  };

  const getFolderColor = (): string => {
    const name = node.name.toLowerCase();
    if (name === 'components') return '#9C27B0';
    if (name === 'screens') return '#2196F3';
    if (name === 'utils' || name === 'lib') return '#FF9800';
    if (name === 'assets' || name === 'images') return '#4CAF50';
    if (name === 'tests' || name.includes('test')) return '#F44336';
    if (name === 'contexts') return '#00BCD4';
    if (name === 'hooks') return '#E91E63';
    if (name === 'config') return '#795548';
    if (name.startsWith('.')) return '#9E9E9E';
    return '#FFA726';
  };

  const icon = node.type === 'folder' ? getFolderIcon() : getFileIcon(node.name);
  const color = node.type === 'folder' ? getFolderColor() : getFileColor(node.name);

  return (
    <TouchableOpacity
      style={[
        styles.fileItem,
        isSelected && styles.fileItemSelected,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {selectionMode && (
        <View style={styles.checkbox}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? theme.palette.primary : theme.palette.text.secondary}
          />
        </View>
      )}

      <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>

      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {node.name}
        </Text>

        {node.type === 'folder' && node.children && (
          <Text style={styles.fileDetails}>
            {node.children.length} Element{node.children.length !== 1 ? 'e' : ''}
          </Text>
        )}

        {node.type === 'file' && node.file && (
          <Text style={styles.fileDetails}>
            {typeof node.file.content === 'string'
              ? `${(node.file.content.length / 1024).toFixed(1)} KB`
              : 'Binary'}
          </Text>
        )}
      </View>

      {!selectionMode && node.type === 'folder' && (
        <Ionicons name="chevron-forward" size={20} color={theme.palette.text.secondary} />
      )}

      {!selectionMode && node.type === 'file' && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onLongPress();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={theme.palette.text.secondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

FileItem.displayName = 'FileItem';

const styles = StyleSheet.create({
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  fileItemSelected: {
    backgroundColor: `${theme.palette.primary}12`,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.primary,
    ...getNeonGlow(theme.palette.primary, 'subtle'),
  },
  checkbox: {
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  fileDetails: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
