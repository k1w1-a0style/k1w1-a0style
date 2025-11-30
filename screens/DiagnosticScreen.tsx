// screens/DiagnosticScreen.tsx – Fehlersuche & Projekt-Check

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { validateProjectFiles } from '../utils/chatUtils';
import { ProjectFile } from '../contexts/types';

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings?: string[];
};

type DiagnosticReport = {
  stats: {
    totalFiles: number;
    totalLines: number;
  };
  structure: {
    hasAppTsx: boolean;
    hasPackageJson: boolean;
    hasTheme: boolean;
  };
  validation: ValidationResult;
  codeIssues: string[];
};

const DiagnosticScreen: React.FC = () => {
  const { projectData } = useProject();
  const [report, setReport] = useState<DiagnosticReport | null>(
    null
  );

  const runDiagnostic = () => {
    const files: ProjectFile[] = projectData?.files ?? [];

    const stats = {
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => {
        const content = String(f.content ?? '');
        return sum + content.split('\n').length;
      }, 0),
    };

    const structure = {
      hasAppTsx: files.some((f) => f.path === 'App.tsx'),
      hasPackageJson: files.some(
        (f) => f.path === 'package.json'
      ),
      hasTheme: files.some((f) => f.path === 'theme.ts'),
    };

    const validation =
      (validateProjectFiles(files) as ValidationResult) ?? {
        valid: true,
        errors: [],
      };

    const codeIssues: string[] = [];

    files.forEach((file) => {
      const { path, content } = file;
      const text = String(content ?? '');

      if (!text.trim()) return;

      // simple heuristics
      if (
        path.endsWith('.tsx') &&
        text.includes('console.log(')
      ) {
        codeIssues.push(
          `${path}: console.log() in TSX gefunden`
        );
      }

      if (path.endsWith('.ts') && text.includes(': any')) {
        codeIssues.push(`${path}: 'any' Type verwendet`);
      }

      if (
        path.startsWith('components/') &&
        !text.includes('export default') &&
        !text.includes('export const')
      ) {
        codeIssues.push(
          `${path}: Component ohne Export (export default/export const fehlt?)`
        );
      }
    });

    setReport({
      stats,
      structure,
      validation,
      codeIssues,
    });
  };

  const renderStatRow = (label: string, value: string) => (
    <View style={styles.row} key={label}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );

  const renderBool = (b: boolean) => (b ? '✓' : '✗');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>🔍 Diagnose</Text>
      <Text style={styles.subtitle}>
        Schneller Projekt-Check: Struktur, Validation & ein paar
        Code-Hinweise.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={runDiagnostic}
      >
        <Text style={styles.buttonText}>Projekt prüfen</Text>
      </TouchableOpacity>

      {!report && (
        <Text style={styles.hint}>
          Drück oben auf „Projekt prüfen“, um eine Diagnose zu
          starten.
        </Text>
      )}

      {report && (
        <View style={styles.reportBox}>
          <Text style={styles.sectionTitle}>📊 Statistiken</Text>
          {renderStatRow(
            'Dateien',
            String(report.stats.totalFiles)
          )}
          {renderStatRow(
            'Gesamtzeilen',
            String(report.stats.totalLines)
          )}

          <Text style={styles.sectionTitle}>✅ Struktur</Text>
          {renderStatRow(
            'App.tsx vorhanden',
            renderBool(report.structure.hasAppTsx)
          )}
          {renderStatRow(
            'package.json vorhanden',
            renderBool(report.structure.hasPackageJson)
          )}
          {renderStatRow(
            'theme.ts vorhanden',
            renderBool(report.structure.hasTheme)
          )}

          <Text style={styles.sectionTitle}>
            ⚠️ Validierung
          </Text>
          {report.validation.valid &&
          (!report.validation.errors ||
            report.validation.errors.length === 0) ? (
            <Text style={styles.success}>
              Keine Validierungsfehler gemeldet.
            </Text>
          ) : (
            (report.validation.errors || []).map(
              (err, idx) => (
                <Text key={idx} style={styles.error}>
                  • {err}
                </Text>
              )
            )
          )}

          {report.validation.warnings &&
            report.validation.warnings.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  💡 Hinweise (Validator)
                </Text>
                {report.validation.warnings.map(
                  (w, idx) => (
                    <Text key={idx} style={styles.warning}>
                      • {w}
                    </Text>
                  )
                )}
              </>
            )}

          {report.codeIssues.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                💡 Code-Hinweise
              </Text>
              {report.codeIssues.map((issue, idx) => (
                <Text key={idx} style={styles.warning}>
                  • {issue}
                </Text>
              ))}
            </>
          )}
        </View>
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
  title: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    marginBottom: 16,
  },
  button: {
    backgroundColor: theme.palette.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  hint: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  reportBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rowLabel: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  rowValue: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  success: {
    color: theme.palette.success,
    fontSize: 13,
  },
  error: {
    color: theme.palette.error,
    fontSize: 13,
  },
  warning: {
    color: theme.palette.warning,
    fontSize: 13,
  },
});
