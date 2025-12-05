// screens/DiagnosticScreen.tsx – Fehlersuche & Projekt-Check

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { validateProjectFiles } from '../utils/chatUtils';
import { validateSyntax, validateCodeQuality } from '../utils/syntaxValidator';
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
    totalSize: number;
    largestFile: string;
    componentCount: number;
    screenCount: number;
  };
  structure: {
    hasAppTsx: boolean;
    hasPackageJson: boolean;
    hasTheme: boolean;
    hasGitignore: boolean;
    hasReadme: boolean;
    hasTypeScriptConfig: boolean;
  };
  validation: ValidationResult;
  codeIssues: string[];
  dependencies: {
    total: number;
    outdated: string[];
    missing: string[];
  };
  performance: {
    filesOver500Lines: string[];
    duplicateCode: string[];
    unusedComponents: string[];
  };
};

const DiagnosticScreen: React.FC = () => {
  const { projectData } = useProject();
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runDiagnostic = useCallback(() => {
    setIsAnalyzing(true);
    
    // Simulate async analysis for better UX
    setTimeout(() => {
      const files: ProjectFile[] = projectData?.files ?? [];

      // Enhanced statistics
      let totalSize = 0;
      let largestFileSize = 0;
      let largestFile = '';
      const componentCount = files.filter(
        (f) => f.path.includes('/components/') || f.path.startsWith('components/')
      ).length;
      const screenCount = files.filter(
        (f) => f.path.includes('/screens/') || f.path.startsWith('screens/')
      ).length;

      const stats = {
        totalFiles: files.length,
        totalLines: files.reduce((sum, f) => {
          const content = String(f.content ?? '');
          const lines = content.split('\n').length;
          const size = content.length;
          totalSize += size;
          
          if (size > largestFileSize) {
            largestFileSize = size;
            largestFile = f.path;
          }
          
          return sum + lines;
        }, 0),
        totalSize,
        largestFile: `${largestFile} (${(largestFileSize / 1024).toFixed(1)}KB)`,
        componentCount,
        screenCount,
      };

      // Enhanced structure checks
      const structure = {
        hasAppTsx: files.some((f) => f.path === 'App.tsx'),
        hasPackageJson: files.some((f) => f.path === 'package.json'),
        hasTheme: files.some((f) => f.path === 'theme.ts' || f.path === 'theme.tsx'),
        hasGitignore: files.some((f) => f.path === '.gitignore'),
        hasReadme: files.some((f) => f.path === 'README.md'),
        hasTypeScriptConfig: files.some((f) => f.path === 'tsconfig.json'),
      };

      const validation =
        (validateProjectFiles(files) as ValidationResult) ?? {
          valid: true,
          errors: [],
        };

      // Enhanced code issue detection
      const codeIssues: string[] = [];
      const filesOver500Lines: string[] = [];
      const unusedComponents: string[] = [];

      files.forEach((file) => {
        const { path, content } = file;
        const text = String(content ?? '');

        if (!text.trim()) return;

        const lines = text.split('\n');
        
        // Check file size
        if (lines.length > 500) {
          filesOver500Lines.push(`${path} (${lines.length} Zeilen)`);
        }

        // Use enhanced validators
        const syntaxErrors = validateSyntax(text, path);
        const qualityErrors = validateCodeQuality(text, path);
        
        syntaxErrors.forEach((err) => {
          if (err.severity === 'error') {
            codeIssues.push(`${path}: ${err.message}`);
          }
        });

        qualityErrors.forEach((err) => {
          if (err.severity === 'warning') {
            codeIssues.push(`${path}: ${err.message}`);
          }
        });

        // Check for unused components
        if ((path.includes('/components/') || path.startsWith('components/')) &&
            !path.endsWith('.test.tsx') &&
            !path.endsWith('.test.ts')) {
          const componentName = path.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '');
          if (componentName) {
            // Simple check: is component imported anywhere else?
            const isUsed = files.some((f) => 
              f.path !== path && String(f.content).includes(componentName)
            );
            if (!isUsed) {
              unusedComponents.push(path);
            }
          }
        }
      });

      // Check dependencies
      const pkgFile = files.find((f) => f.path === 'package.json');
      let dependencies = {
        total: 0,
        outdated: [] as string[],
        missing: [] as string[],
      };

      if (pkgFile) {
        try {
          const pkg = JSON.parse(String(pkgFile.content));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          dependencies.total = Object.keys(deps).length;
          
          // Note: Actual outdated/missing check would require npm registry API
          // This is a simplified version
        } catch (e) {
          codeIssues.push('package.json: Konnte nicht geparst werden');
        }
      }

      setReport({
        stats,
        structure,
        validation,
        codeIssues,
        dependencies,
        performance: {
          filesOver500Lines,
          duplicateCode: [],
          unusedComponents,
        },
      });
      
      setIsAnalyzing(false);
    }, 500);
  }, [projectData]);

  const renderStatRow = (label: string, value: string) => (
    <View style={styles.row} key={label}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );

  const renderBool = (b: boolean) => (b ? '✓' : '✗');

  const hasIssues = useMemo(() => {
    if (!report) return false;
    return (
      !report.validation.valid ||
      report.codeIssues.length > 0 ||
      report.performance.filesOver500Lines.length > 0 ||
      report.performance.unusedComponents.length > 0
    );
  }, [report]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Ionicons name="fitness-outline" size={32} color={theme.palette.primary} />
          <View style={styles.headerText}>
            <Text style={styles.title}>🔍 Projekt-Diagnose</Text>
            <Text style={styles.subtitle}>
              Umfassende Analyse: Struktur, Code-Qualität, Performance & Dependencies
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, isAnalyzing && styles.buttonDisabled]}
          onPress={runDiagnostic}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={styles.buttonText}>Analyse starten</Text>
            </>
          )}
        </TouchableOpacity>

      {!report && (
        <Text style={styles.hint}>
          Drück oben auf „Projekt prüfen“, um eine Diagnose zu
          starten.
        </Text>
      )}

      {report && (
        <>
          {/* Health Score */}
          <View style={[styles.healthCard, hasIssues ? styles.healthWarning : styles.healthGood]}>
            <Ionicons
              name={hasIssues ? 'warning' : 'checkmark-circle'}
              size={32}
              color={hasIssues ? theme.palette.warning : theme.palette.success}
            />
            <View style={styles.healthText}>
              <Text style={styles.healthTitle}>
                {hasIssues ? '⚠️ Verbesserungen empfohlen' : '✅ Projekt gesund'}
              </Text>
              <Text style={styles.healthSubtitle}>
                {hasIssues
                  ? 'Einige Probleme wurden gefunden'
                  : 'Keine kritischen Probleme erkannt'}
              </Text>
            </View>
          </View>

          <View style={styles.reportBox}>
            <Text style={styles.sectionTitle}>📊 Statistiken</Text>
            {renderStatRow('Dateien', String(report.stats.totalFiles))}
            {renderStatRow('Gesamtzeilen', String(report.stats.totalLines))}
            {renderStatRow('Größe', `${(report.stats.totalSize / 1024).toFixed(1)} KB`)}
            {renderStatRow('Größte Datei', report.stats.largestFile)}
            {renderStatRow('Komponenten', String(report.stats.componentCount))}
            {renderStatRow('Screens', String(report.stats.screenCount))}

            <Text style={styles.sectionTitle}>📦 Dependencies</Text>
            {renderStatRow('Gesamt', String(report.dependencies.total))}

            <Text style={styles.sectionTitle}>✅ Projekt-Struktur</Text>
            {renderStatRow('App.tsx', renderBool(report.structure.hasAppTsx))}
            {renderStatRow('package.json', renderBool(report.structure.hasPackageJson))}
            {renderStatRow('theme.ts', renderBool(report.structure.hasTheme))}
            {renderStatRow('.gitignore', renderBool(report.structure.hasGitignore))}
            {renderStatRow('README.md', renderBool(report.structure.hasReadme))}
            {renderStatRow('tsconfig.json', renderBool(report.structure.hasTypeScriptConfig))}

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
              <Text style={styles.sectionTitle}>💡 Code-Hinweise</Text>
              {report.codeIssues.slice(0, 10).map((issue, idx) => (
                <Text key={idx} style={styles.warning}>
                  • {issue}
                </Text>
              ))}
              {report.codeIssues.length > 10 && (
                <Text style={styles.hint}>
                  ... und {report.codeIssues.length - 10} weitere Hinweise
                </Text>
              )}
            </>
          )}

          {report.performance.filesOver500Lines.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>⚡ Performance-Hinweise</Text>
              <Text style={styles.warning}>
                {report.performance.filesOver500Lines.length} Datei(en) mit >500 Zeilen gefunden:
              </Text>
              {report.performance.filesOver500Lines.slice(0, 5).map((file, idx) => (
                <Text key={idx} style={styles.warningDetail}>
                  • {file}
                </Text>
              ))}
            </>
          )}

          {report.performance.unusedComponents.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>🧹 Ungenutzte Komponenten</Text>
              <Text style={styles.warning}>
                {report.performance.unusedComponents.length} möglicherweise ungenutzte Komponente(n):
              </Text>
              {report.performance.unusedComponents.slice(0, 5).map((comp, idx) => (
                <Text key={idx} style={styles.warningDetail}>
                  • {comp}
                </Text>
              ))}
            </>
          )}
        </View>
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DiagnosticScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
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
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  healthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
  },
  healthGood: {
    backgroundColor: `${theme.palette.success}10`,
    borderColor: theme.palette.success,
  },
  healthWarning: {
    backgroundColor: `${theme.palette.warning}10`,
    borderColor: theme.palette.warning,
  },
  healthText: {
    flex: 1,
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 2,
  },
  healthSubtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
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
    marginBottom: 4,
  },
  warningDetail: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginLeft: 8,
    marginBottom: 2,
  },
  hint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
