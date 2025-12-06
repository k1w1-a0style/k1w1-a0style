// screens/DiagnosticScreen.tsx – Projekt-Check + Chat-Integration

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { v4 as uuidv4 } from 'uuid';

type DiagnosticStats = {
  totalFiles: number;
  totalLines: number;
  tsFiles: number;
  tsxFiles: number;
  jsFiles: number;
  jsonFiles: number;
  otherFiles: number;
};

type StructureInfo = {
  hasAppTsx: boolean;
  hasPackageJson: boolean;
  hasTheme: boolean;
};

type DiagnosticResult = {
  stats: DiagnosticStats;
  structure: StructureInfo;
  warnings: string[];
};

const runSimpleDiagnostics = (projectData: any | null): DiagnosticResult => {
  const files = projectData?.files ?? [];

  const stats: DiagnosticStats = {
    totalFiles: files.length,
    totalLines: 0,
    tsFiles: 0,
    tsxFiles: 0,
    jsFiles: 0,
    jsonFiles: 0,
    otherFiles: 0,
  };

  let hasAppTsx = false;
  let hasPackageJson = false;
  let hasTheme = false;

  for (const f of files) {
    const path = String(f.path ?? '');
    const content = String(f.content ?? '');
    const lower = path.toLowerCase();

    if (lower.endsWith('.ts')) stats.tsFiles += 1;
    else if (lower.endsWith('.tsx')) stats.tsxFiles += 1;
    else if (lower.endsWith('.js')) stats.jsFiles += 1;
    else if (lower.endsWith('.json')) stats.jsonFiles += 1;
    else stats.otherFiles += 1;

    stats.totalLines += content.split('\n').length;

    if (lower === 'app.tsx') hasAppTsx = true;
    if (lower === 'package.json') hasPackageJson = true;
    if (lower.endsWith('/theme.ts') || lower === 'theme.ts') hasTheme = true;
  }

  const warnings: string[] = [];

  if (!hasAppTsx) {
    warnings.push('App.tsx fehlt oder wurde nicht gefunden.');
  }
  if (!hasPackageJson) {
    warnings.push('package.json fehlt – EAS / npm Builds können Probleme machen.');
  }
  if (!hasTheme) {
    warnings.push('theme.ts wurde nicht gefunden – Styles könnten brechen.');
  }
  if (stats.totalFiles === 0) {
    warnings.push('Es wurden keine Projektdateien gefunden.');
  }
  if (stats.totalLines > 5000) {
    warnings.push(
      `Großes Projekt (~${stats.totalLines.toLocaleString()} Zeilen) – KI-Kontext kann eng werden.`,
    );
  }

  return {
    stats,
    structure: {
      hasAppTsx,
      hasPackageJson,
      hasTheme,
    },
    warnings,
  };
};

const DiagnosticScreen: React.FC = () => {
  const { projectData, addChatMessage } = useProject();
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleRunDiagnostics = () => {
    setIsChecking(true);
    try {
      const res = runSimpleDiagnostics(projectData);
      setResult(res);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSendToChat = () => {
    if (!result) return;

    const { stats, structure, warnings } = result;

    const lines: string[] = [];
    lines.push('🔍 Projekt-Diagnose (k1w1-a0style):');
    lines.push('');
    lines.push('📦 Dateien:');
    lines.push(`• Gesamt: ${stats.totalFiles}`);
    lines.push(
      `• TS: ${stats.tsFiles}, TSX: ${stats.tsxFiles}, JS: ${stats.jsFiles}, JSON: ${stats.jsonFiles}, Sonstige: ${stats.otherFiles}`,
    );
    lines.push(`• Geschätzte Zeilen: ~${stats.totalLines.toLocaleString()}`);
    lines.push('');
    lines.push('📁 Struktur:');
    lines.push(`• App.tsx: ${structure.hasAppTsx ? '✅' : '❌ fehlt'}`);
    lines.push(
      `• package.json: ${structure.hasPackageJson ? '✅' : '❌ fehlt'}`,
    );
    lines.push(`• theme.ts: ${structure.hasTheme ? '✅' : '⚠️ nicht gefunden'}`);
    lines.push('');

    if (warnings.length > 0) {
      lines.push('⚠️ Warnungen:');
      for (const w of warnings) {
        lines.push(`• ${w}`);
      }
      lines.push('');
    }

    lines.push(
      '👉 Bitte analysiere diesen Diagnosebericht und optimiere das Projekt entsprechend.',
    );

    const content = lines.join('\n');

    addChatMessage({
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    } as any);
  };

  const renderStatRow = (label: string, value: string | number) => (
    <View style={styles.statRow} key={label}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{String(value)}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons
          name="medkit-outline"
          size={26}
          color={theme.palette.primary}
        />
        <View style={{ marginLeft: 8 }}>
          <Text style={styles.title}>Projekt-Diagnose</Text>
          <Text style={styles.subtitle}>
            Checkt Struktur & Dateigröße und kann an die KI gegeben werden.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Projekt prüfen</Text>
        <Text style={styles.cardText}>
          Es werden keine Dateien verändert – nur analysiert.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleRunDiagnostics}
          disabled={isChecking}
        >
          {isChecking ? (
            <ActivityIndicator color={theme.palette.background} />
          ) : (
            <>
              <Ionicons
                name="search-outline"
                size={18}
                color={theme.palette.background}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.primaryButtonText}>Projekt prüfen</Text>
            </>
          )}
        </TouchableOpacity>

        {result && (
          <TouchableOpacity
            style={[styles.secondaryButton, !result && { opacity: 0.5 }]}
            onPress={handleSendToChat}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={18}
              color={theme.palette.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.secondaryButtonText}>
              Diagnose in Chat senden
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {result && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Statistiken</Text>
            {renderStatRow('Dateien gesamt', result.stats.totalFiles)}
            {renderStatRow(
              'Zeilen (geschätzt)',
              result.stats.totalLines.toLocaleString(),
            )}
            {renderStatRow('TS-Dateien', result.stats.tsFiles)}
            {renderStatRow('TSX-Dateien', result.stats.tsxFiles)}
            {renderStatRow('JS-Dateien', result.stats.jsFiles)}
            {renderStatRow('JSON-Dateien', result.stats.jsonFiles)}
            {renderStatRow('Sonstige', result.stats.otherFiles)}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Struktur</Text>
            <Text style={styles.infoLine}>
              App.tsx: {result.structure.hasAppTsx ? '✅ vorhanden' : '❌ fehlt'}
            </Text>
            <Text style={styles.infoLine}>
              package.json:{' '}
              {result.structure.hasPackageJson ? '✅ vorhanden' : '❌ fehlt'}
            </Text>
            <Text style={styles.infoLine}>
              theme.ts:{' '}
              {result.structure.hasTheme
                ? '✅ vorhanden'
                : '⚠️ nicht gefunden'}
            </Text>
          </View>

          {result.warnings.length > 0 && (
            <View style={styles.cardWarning}>
              <Text style={styles.cardTitle}>Warnungen</Text>
              {result.warnings.map((w) => (
                <Text key={w} style={styles.warningText}>
                  • {w}
                </Text>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default DiagnosticScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cardWarning: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.error,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  primaryButtonText: {
    color: theme.palette.background,
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: theme.palette.primary,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: theme.palette.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  statValue: {
    fontSize: 13,
    color: theme.palette.text.primary,
  },
  infoLine: {
    fontSize: 13,
    color: theme.palette.text.primary,
    marginTop: 4,
  },
  warningText: {
    fontSize: 13,
    color: theme.palette.error,
    marginTop: 4,
  },
});
