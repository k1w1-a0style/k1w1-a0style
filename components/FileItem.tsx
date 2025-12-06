import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { TreeNode } from './FileTree';

interface FileItemProps {
  node: TreeNode;
  onPress: () => void;
  onLongPress: () => void;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
    case 'ts':
      return 'logo-react';
    case 'js':
    case 'jsx':
      return 'logo-javascript';
    case 'json':
      return 'document-text';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return 'image';
    case 'md':
      return 'document-outline';
    default:
      return 'document-text-outline';
  }
};

const getFileColor = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
    case 'ts':
      return '#61DAFB'; // React/TS
    case 'js':
    case 'jsx':
      return '#F7DF1E'; // JS
    case 'json':
      return '#FFB000'; // JSON
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return '#4CAF50'; // Media
    case 'md':
      return '#0366D6'; // Markdown
    default:
      return theme.palette.text.secondary;
  }
};

const arePropsEqual = (prevProps: FileItemProps, nextProps: FileItemProps) => {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.type === nextProps.node.type &&
    prevProps.node.path === nextProps.node.path &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onLongPress === nextProps.onLongPress
  );
};

const FileItem = memo(
  ({ node, onPress, onLongPress }: FileItemProps) => {
    return (
      <TouchableOpacity
        style={styles.fileItem}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        <View style={styles.fileItemContent}>
          <Ionicons
            name={node.type === 'folder' ? 'folder' : getFileIcon(node.name)}
            size={24}
            color={node.type === 'folder' ? '#FFA726' : getFileColor(node.name)}
          />
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {node.name}
            </Text>
            {node.type === 'folder' && node.children && (
              <Text style={styles.fileDetails}>
                {node.children.length} Element
                {node.children.length !== 1 ? 'e' : ''}
              </Text>
            )}
            {node.type === 'file' && node.file && (
              <Text style={styles.fileDetails}>
                {typeof node.file.content === 'string'
                  ? `${node.file.content.length} Zeichen`
                  : 'Binary'}
              </Text>
            )}
          </View>
        </View>
        {node.type === 'folder' && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.palette.text.secondary}
          />
        )}
      </TouchableOpacity>
    );
  },
  arePropsEqual,
);

// 🔧 Für ESLint: display-name
FileItem.displayName = 'FileItem';

const styles = StyleSheet.create({
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  fileItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.palette.text.primary,
    marginBottom: 2,
  },
  fileDetails: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
});

export default FileItem;
