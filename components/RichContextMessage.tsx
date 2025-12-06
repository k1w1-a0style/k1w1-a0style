// components/RichContextMessage.tsx
// Zeigt Builder-/Orchestrator-Kontext unter KI-Nachrichten
// Scrollbare Code-Boxen mit einfacher Diff-Farbgebung (angepasst, kein theme.typography)

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';
import {
  BuilderContextData,
  ContextFileChange,
  ProjectFile,
} from '../contexts/types';

type Props = {
  context?: BuilderContextData | null;
};

const RichContextMessage: React.FC<Props> = ({ context }) => {
  if (!context) return null;

  const ctx = context as BuilderContextData & {
    files?: ProjectFile[];
    changes?: ContextFileChange[];
  };

  // Unterstützt neue Struktur ("files"/"changes") + legacy ("filesChanged")
  const files: ProjectFile[] = (ctx.files ?? []) as ProjectFile[];
  const changes: ContextFileChange[] =
    (ctx.changes ?? ctx.filesChanged ?? []) as ContextFileChange[];

  const created = changes.filter((c) => c.type === 'created').length;
  const updated = changes.filter((c) => c.type === 'updated').length;
  const deleted = changes.filter((c) => c.type === 'deleted').length;

  const durationMs =
    typeof ctx.duration === 'number' ? ctx.duration : undefined;
  const durationText =
    typeof durationMs === 'number' ? `${Math.round(durationMs)} ms` : undefined;

  const totalLines =
    typeof ctx.totalLines === 'number' ? ctx.totalLines : undefined;

  const keysRotated =
    typeof ctx.keysRotated === 'number' ? ctx.keysRotated : undefined;

  const summaryText =
    typeof ctx.summary === 'string' ? ctx.summary.trim() : '';

  const qualityText =
    typeof ctx.quality === 'string' ? ctx.quality.trim() : '';

  const messageCount =
    typeof ctx.messageCount === 'number' ? ctx.messageCount : undefined;

  const hasMetaInfo =
    Boolean(ctx.provider) ||
    Boolean(ctx.model) ||
    Boolean(durationText) ||
    typeof totalLines === 'number' ||
    typeof keysRotated === 'number' ||
    Boolean(qualityText) ||
    typeof messageCount === 'number';

  const hasFiles = Array.isArray(files) && files.length > 0;
  const hasChanges = Array.isArray(changes) && changes.length > 0;

  let summaryLine = '';
  if (summaryText) {
    summaryLine = summaryText;
  } else if (hasChanges) {
    const total = changes.length;
    summaryLine = `${total} Änderung${total === 1 ? '' : 'en'}`;

    const detailParts: string[] = [];
    if (created > 0) detailParts.push(`${created} neu`);
    if (updated > 0) detailParts.push(`${updated} geändert`);
    if (deleted > 0) detailParts.push(`${deleted} gelöscht`);
    if (detailParts.length > 0) {
      summaryLine += ` (${detailParts.join(', ')})`;
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Builder-Kontext</Text>

      {hasMetaInfo && (
        <View style={styles.metaRow}>
          {ctx.provider && (
            <Text style={styles.metaText}>
              Provider: <Text style={styles.metaValue}>{ctx.provider}</Text>
            </Text>
          )}
          {ctx.model && (
            <Text style={styles.metaText}>
              Model: <Text style={styles.metaValue}>{ctx.model}</Text>
            </Text>
          )}
          {durationText && (
            <Text style={styles.metaText}>
              Dauer: <Text style={styles.metaValue}>{durationText}</Text>
            </Text>
          )}
          {typeof totalLines === 'number' && (
            <Text style={styles.metaText}>
              Zeilen: <Text style={styles.metaValue}>{totalLines}</Text>
            </Text>
          )}
          {typeof keysRotated === 'number' && (
            <Text style={styles.metaText}>
              Keys rotiert:{' '}
              <Text style={styles.metaValue}>{keysRotated}</Text>
            </Text>
          )}
          {qualityText && (
            <Text style={styles.metaText}>
              Modus: <Text style={styles.metaValue}>{qualityText}</Text>
            </Text>
          )}
          {typeof messageCount === 'number' && (
            <Text style={styles.metaText}>
              Prompts: <Text style={styles.metaValue}>{messageCount}</Text>
            </Text>
          )}
        </View>
      )}

      {summaryLine ? <Text style={styles.summary}>{summaryLine}</Text> : null}

      {hasFiles && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dateien im Kontext</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fileListRow}
          >
            {files.map((f, idx) => (
              <View key={`${f.path}-${idx}`} style={styles.fileChip}>
                <Text style={styles.fileChipText}>{f.path}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {hasChanges && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Änderungen</Text>
          {changes.map((c, idx) => (
            <View key={`${c.path}-${idx}`} style={styles.changeRow}>
              <Text style={styles.changePath} numberOfLines={1}>
                {c.path}
              </Text>
              <Text style={styles.changeType}>{c.type.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}

      {hasChanges && (
        <View style={styles.previewBlock}>
          <Text style={styles.previewTitle}>Diff-Vorschau</Text>
          <ScrollView
            style={styles.codeScroll}
            contentContainerStyle={styles.codeScrollContent}
          >
            {changes.map((c, idx) => {
              if (!c.preview) return null;
              const lines = c.preview.split('\n').slice(0, 80); // nicht eskalieren

              return (
                <View key={`${c.path}-preview-${idx}`} style={{ marginBottom: 6 }}>
                  <Text style={styles.changePath}>{c.path}</Text>
                  {lines.map((line, lineIdx) => {
                    let lineStyle = styles.codeLine;
                    if (line.startsWith('+')) {
                      lineStyle = [styles.codeLine, styles.codeAdded];
                    } else if (line.startsWith('-')) {
                      lineStyle = [styles.codeLine, styles.codeRemoved];
                    } else if (line.startsWith('@@')) {
                      lineStyle = [styles.codeLine, styles.codeHunk];
                    }
                    return (
                      <Text key={lineIdx} style={lineStyle}>
                        {line || ' '}
                      </Text>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  metaValue: {
    color: theme.palette.text.primary,
    fontWeight: '600',
  },
  summary: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginBottom: 6,
  },
  section: {
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  fileListRow: {
    flexDirection: 'row',
    gap: 6,
  },
  fileChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.palette.primarySoft,
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  fileChipText: {
    fontSize: 10,
    color: theme.palette.primary,
    fontWeight: '600',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.palette.border,
  },
  changePath: {
    fontSize: 10,
    color: theme.palette.text.primary,
    flex: 1,
    paddingRight: 8,
  },
  changeType: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.primary,
  },
  previewBlock: {
    marginTop: 8,
  },
  previewTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 2,
  },
  codeScroll: {
    maxHeight: 220,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.code.border,
    backgroundColor: theme.palette.code.background,
  },
  codeScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  codeLine: {
    // kein theme.typography, damit es überall läuft
    fontFamily: 'monospace',
    fontSize: 10,
    color: theme.palette.text.primary,
    lineHeight: 14,
    paddingVertical: 1,
  },
  codeAdded: {
    backgroundColor: '#003b1f',
  },
  codeRemoved: {
    backgroundColor: '#3b000a',
  },
  codeHunk: {
    backgroundColor: '#0b1f2a',
  },
});

export default RichContextMessage;
