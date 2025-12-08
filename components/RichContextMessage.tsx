// components/RichContextMessage.tsx
// Zeigt Builder-/Orchestrator-Kontext unter KI-Nachrichten
// Collapsible, optimierte Darstellung mit Diff-Vorschau

import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import {
  BuilderContextData,
  ContextFileChange,
  ProjectFile,
} from '../contexts/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  context?: BuilderContextData | null;
};

/** Formatiert Millisekunden lesbar */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
};

/** Badge für Change-Type */
const ChangeTypeBadge: React.FC<{ type: string }> = memo(({ type }) => {
  const badgeStyle = useMemo(() => {
    switch (type) {
      case 'created':
        return styles.badgeCreated;
      case 'updated':
        return styles.badgeUpdated;
      case 'deleted':
        return styles.badgeDeleted;
      default:
        return styles.badgeDefault;
    }
  }, [type]);

  const label = type === 'created' ? 'NEU' : type === 'updated' ? 'EDIT' : type.toUpperCase();

  return (
    <View style={[styles.badge, badgeStyle]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
});

const RichContextMessage: React.FC<Props> = memo(({ context }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(prev => !prev);
  }, []);

  const togglePreview = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowPreview(prev => !prev);
  }, []);

  if (!context) return null;

  const ctx = context as BuilderContextData & {
    files?: ProjectFile[];
    changes?: ContextFileChange[];
  };

  // Unterstützt neue Struktur ("files"/"changes") + legacy ("filesChanged")
  const files: ProjectFile[] = ctx.files ?? [];
  const changes: ContextFileChange[] = ctx.changes ?? ctx.filesChanged ?? [];

  const created = changes.filter((c) => c.type === 'created').length;
  const updated = changes.filter((c) => c.type === 'updated').length;
  const deleted = changes.filter((c) => c.type === 'deleted').length;

  const durationMs = typeof ctx.duration === 'number' ? ctx.duration : undefined;
  const durationText = typeof durationMs === 'number' ? formatDuration(durationMs) : undefined;

  const totalLines = typeof ctx.totalLines === 'number' ? ctx.totalLines : undefined;
  const keysRotated = typeof ctx.keysRotated === 'number' && ctx.keysRotated > 0 ? ctx.keysRotated : undefined;
  const qualityText = typeof ctx.quality === 'string' ? ctx.quality.trim() : '';
  const messageCount = typeof ctx.messageCount === 'number' ? ctx.messageCount : undefined;

  const hasChanges = changes.length > 0;
  const hasPreviewContent = changes.some(c => c.preview && c.preview.trim().length > 0);

  // Kompakte Summary-Zeile für den Header
  const summaryParts: string[] = [];
  if (created > 0) summaryParts.push(`+${created}`);
  if (updated > 0) summaryParts.push(`~${updated}`);
  if (deleted > 0) summaryParts.push(`-${deleted}`);
  const summaryLine = summaryParts.length > 0 
    ? `${changes.length} Datei${changes.length !== 1 ? 'en' : ''} (${summaryParts.join(', ')})`
    : 'Keine Änderungen';

  return (
    <View style={styles.container}>
      {/* Collapsible Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpand}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Builder-Kontext ${isExpanded ? 'einklappen' : 'ausklappen'}`}
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={14}
            color={theme.palette.text.secondary}
          />
          <Text style={styles.title}>Builder-Kontext</Text>
        </View>
        <View style={styles.headerRight}>
          {durationText && (
            <Text style={styles.headerMeta}>⏱ {durationText}</Text>
          )}
          <Text style={styles.headerSummary}>{summaryLine}</Text>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Meta-Informationen */}
          <View style={styles.metaGrid}>
            {ctx.provider && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Provider</Text>
                <Text style={styles.metaValue}>{ctx.provider}</Text>
              </View>
            )}
            {ctx.model && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Model</Text>
                <Text style={styles.metaValue} numberOfLines={1}>{ctx.model}</Text>
              </View>
            )}
            {qualityText && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Modus</Text>
                <Text style={styles.metaValue}>
                  {qualityText === 'speed' ? '⚡ Speed' : '🎯 Quality'}
                </Text>
              </View>
            )}
            {typeof totalLines === 'number' && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Zeilen</Text>
                <Text style={styles.metaValue}>{totalLines.toLocaleString()}</Text>
              </View>
            )}
            {typeof messageCount === 'number' && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Prompts</Text>
                <Text style={styles.metaValue}>{messageCount}</Text>
              </View>
            )}
            {keysRotated && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Key-Rotation</Text>
                <Text style={[styles.metaValue, styles.warningText]}>
                  {keysRotated}x rotiert
                </Text>
              </View>
            )}
          </View>

          {/* Datei-Liste */}
          {hasChanges && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Geänderte Dateien</Text>
              <View style={styles.changesList}>
                {changes.slice(0, 10).map((c, idx) => (
                  <View key={`${c.path}-${idx}`} style={styles.changeRow}>
                    <ChangeTypeBadge type={c.type} />
                    <Text style={styles.changePath} numberOfLines={1}>
                      {c.path}
                    </Text>
                  </View>
                ))}
                {changes.length > 10 && (
                  <Text style={styles.moreText}>
                    +{changes.length - 10} weitere Dateien
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Code-Vorschau Toggle */}
          {hasPreviewContent && (
            <TouchableOpacity
              style={styles.previewToggle}
              onPress={togglePreview}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPreview ? 'code-slash' : 'code'}
                size={14}
                color={theme.palette.primary}
              />
              <Text style={styles.previewToggleText}>
                {showPreview ? 'Code-Vorschau ausblenden' : 'Code-Vorschau anzeigen'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Code-Vorschau */}
          {showPreview && hasPreviewContent && (
            <View style={styles.previewBlock}>
              <ScrollView
                style={styles.codeScroll}
                contentContainerStyle={styles.codeScrollContent}
                nestedScrollEnabled
              >
                {changes.map((c, idx) => {
                  if (!c.preview) return null;
                  const lines = c.preview.split('\n').slice(0, 50);

                  return (
                    <View key={`${c.path}-preview-${idx}`} style={styles.previewFile}>
                      <Text style={styles.previewFileName}>{c.path}</Text>
                      {lines.map((line, lineIdx) => {
                        const isAdded = line.startsWith('+');
                        const isRemoved = line.startsWith('-');
                        const isHunk = line.startsWith('@@');
                        return (
                          <Text
                            key={lineIdx}
                            style={[
                              styles.codeLine,
                              isAdded && styles.codeAdded,
                              isRemoved && styles.codeRemoved,
                              isHunk && styles.codeHunk,
                            ]}
                          >
                            {line || ' '}
                          </Text>
                        );
                      })}
                      {c.preview.split('\n').length > 50 && (
                        <Text style={styles.truncatedText}>
                          ... {c.preview.split('\n').length - 50} weitere Zeilen
                        </Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

RichContextMessage.displayName = 'RichContextMessage';
ChangeTypeBadge.displayName = 'ChangeTypeBadge';

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    overflow: 'hidden',
  },
  
  // Header (immer sichtbar)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.palette.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  headerMeta: {
    fontSize: 10,
    color: theme.palette.text.muted,
  },
  headerSummary: {
    fontSize: 10,
    color: theme.palette.text.secondary,
    fontWeight: '500',
  },

  // Expanded Content
  expandedContent: {
    padding: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },

  // Meta Grid
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  metaItem: {
    minWidth: 70,
  },
  metaLabel: {
    fontSize: 9,
    color: theme.palette.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 11,
    color: theme.palette.text.primary,
    fontWeight: '600',
  },
  warningText: {
    color: theme.palette.warning,
  },

  // Section
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // Changes List
  changesList: {
    gap: 4,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  changePath: {
    fontSize: 11,
    color: theme.palette.text.primary,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  moreText: {
    fontSize: 10,
    color: theme.palette.text.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Badges
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  badgeCreated: {
    backgroundColor: '#006633',
  },
  badgeUpdated: {
    backgroundColor: '#0066cc',
  },
  badgeDeleted: {
    backgroundColor: '#cc3333',
  },
  badgeDefault: {
    backgroundColor: theme.palette.text.muted,
  },

  // Preview Toggle
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
  },
  previewToggleText: {
    fontSize: 11,
    color: theme.palette.primary,
    fontWeight: '500',
  },

  // Code Preview
  previewBlock: {
    marginTop: 8,
  },
  codeScroll: {
    maxHeight: 200,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.code.border,
    backgroundColor: theme.palette.code.background,
  },
  codeScrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  previewFile: {
    marginBottom: 12,
  },
  previewFileName: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.primary,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeLine: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: theme.palette.text.primary,
    lineHeight: 15,
    paddingVertical: 1,
  },
  codeAdded: {
    backgroundColor: 'rgba(0, 180, 60, 0.2)',
    color: '#4ade80',
  },
  codeRemoved: {
    backgroundColor: 'rgba(220, 50, 50, 0.2)',
    color: '#f87171',
  },
  codeHunk: {
    backgroundColor: 'rgba(100, 150, 200, 0.15)',
    color: theme.palette.text.muted,
  },
  truncatedText: {
    fontSize: 10,
    color: theme.palette.text.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default RichContextMessage;
