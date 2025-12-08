// screens/DiagnosticScreen.tsx – Advanced Project Diagnostics with Export

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { v4 as uuidv4 } from 'uuid';

type DiagnosticStats = {
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  tsFiles: number;
  tsxFiles: number;
  jsFiles: number;
  jsxFiles: number;
  jsonFiles: number;
  markdownFiles: number;
  configFiles: number;
  otherFiles: number;
  largestFile: { path: string; size: number; lines: number } | null;
  smallestFile: { path: string; size: number; lines: number } | null;
  avgFileSize: number;
  avgLines: number;
};

type StructureInfo = {
  hasAppTsx: boolean;
  hasPackageJson: boolean;
  hasTheme: boolean;
  hasTsConfig: boolean;
  hasEslintConfig: boolean;
  hasGitignore: boolean;
  hasReadme: boolean;
  hasEnvExample: boolean;
};

type DependencyInfo = {
  totalDependencies: number;
  totalDevDependencies: number;
  outdatedWarning: boolean;
  missingScripts: string[];
};

type CodeQuality = {
  filesWithLongLines: number;
  filesWithManyLines: number;
  emptyFiles: number;
  largeFiles: number;
  duplicateNames: string[];
};

type SecurityIssue = {
  type: 'warning' | 'error' | 'info';
  message: string;
  recommendation?: string;
};

type DiagnosticResult = {
  stats: DiagnosticStats;
  structure: StructureInfo;
  dependencies: DependencyInfo;
  codeQuality: CodeQuality;
  warnings: string[];
  errors: string[];
  recommendations: string[];
  securityIssues: SecurityIssue[];
  healthScore: number;
};

const getFileSize = (content: string): number => {
  return new Blob([content]).size;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const runAdvancedDiagnostics = (projectData: any | null): DiagnosticResult => {
  const files = projectData?.files ?? [];

  // Initialize stats
  const stats: DiagnosticStats = {
    totalFiles: files.length,
    totalLines: 0,
    totalSize: 0,
    tsFiles: 0,
    tsxFiles: 0,
    jsFiles: 0,
    jsxFiles: 0,
    jsonFiles: 0,
    markdownFiles: 0,
    configFiles: 0,
    otherFiles: 0,
    largestFile: null,
    smallestFile: null,
    avgFileSize: 0,
    avgLines: 0,
  };

  const structure: StructureInfo = {
    hasAppTsx: false,
    hasPackageJson: false,
    hasTheme: false,
    hasTsConfig: false,
    hasEslintConfig: false,
    hasGitignore: false,
    hasReadme: false,
    hasEnvExample: false,
  };

  const dependencies: DependencyInfo = {
    totalDependencies: 0,
    totalDevDependencies: 0,
    outdatedWarning: false,
    missingScripts: [],
  };

  const codeQuality: CodeQuality = {
    filesWithLongLines: 0,
    filesWithManyLines: 0,
    emptyFiles: 0,
    largeFiles: 0,
    duplicateNames: [],
  };

  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendations: string[] = [];
  const securityIssues: SecurityIssue[] = [];

  // Track file names for duplicates
  const fileNames = new Map<string, number>();

  // Analyze each file
  for (const f of files) {
    const path = String(f.path ?? '');
    const content = String(f.content ?? '');
    const lower = path.toLowerCase();
    const lines = content.split('\n');
    const lineCount = lines.length;
    const size = getFileSize(content);
    const fileName = path.split('/').pop() || '';

    // File type counting
    if (lower.endsWith('.ts')) stats.tsFiles += 1;
    else if (lower.endsWith('.tsx')) stats.tsxFiles += 1;
    else if (lower.endsWith('.js')) stats.jsFiles += 1;
    else if (lower.endsWith('.jsx')) stats.jsxFiles += 1;
    else if (lower.endsWith('.json')) stats.jsonFiles += 1;
    else if (lower.endsWith('.md')) stats.markdownFiles += 1;
    else if (lower.includes('config') || lower.includes('.rc') || lower === '.eslintrc' || lower === '.prettierrc') {
      stats.configFiles += 1;
    } else {
      stats.otherFiles += 1;
    }

    // Track duplicates
    fileNames.set(fileName, (fileNames.get(fileName) || 0) + 1);

    // Stats
    stats.totalLines += lineCount;
    stats.totalSize += size;

    // Largest/smallest file tracking
    if (!stats.largestFile || size > stats.largestFile.size) {
      stats.largestFile = { path, size, lines: lineCount };
    }
    if (!stats.smallestFile || (size < stats.smallestFile.size && size > 0)) {
      stats.smallestFile = { path, size, lines: lineCount };
    }

    // Code quality checks
    if (content.trim() === '') {
      codeQuality.emptyFiles += 1;
    }
    if (lineCount > 500) {
      codeQuality.filesWithManyLines += 1;
    }
    if (size > 100 * 1024) { // > 100KB
      codeQuality.largeFiles += 1;
    }

    // Check for long lines
    const hasLongLines = lines.some(line => line.length > 120);
    if (hasLongLines) {
      codeQuality.filesWithLongLines += 1;
    }

    // Structure checks
    if (lower === 'app.tsx' || lower.endsWith('/app.tsx')) structure.hasAppTsx = true;
    if (lower === 'package.json') {
      structure.hasPackageJson = true;
      
      // Analyze package.json
      try {
        const pkg = JSON.parse(content);
        dependencies.totalDependencies = Object.keys(pkg.dependencies || {}).length;
        dependencies.totalDevDependencies = Object.keys(pkg.devDependencies || {}).length;
        
        const scripts = pkg.scripts || {};
        if (!scripts.start) dependencies.missingScripts.push('start');
        if (!scripts.test) dependencies.missingScripts.push('test');
        if (!scripts.build) dependencies.missingScripts.push('build');

        // Check for security issues in dependencies
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps['*'] || Object.keys(allDeps).some(key => allDeps[key] === '*')) {
          securityIssues.push({
            type: 'error',
            message: 'Wildcard (*) versions in dependencies gefunden',
            recommendation: 'Fixiere Versionen für reproduzierbare Builds',
          });
        }
      } catch (e) {
        errors.push('package.json konnte nicht geparst werden');
      }
    }
    if (lower.endsWith('/theme.ts') || lower === 'theme.ts') structure.hasTheme = true;
    if (lower === 'tsconfig.json') structure.hasTsConfig = true;
    if (lower === '.eslintrc' || lower === '.eslintrc.js' || lower === '.eslintrc.json' || lower === 'eslint.config.js') {
      structure.hasEslintConfig = true;
    }
    if (lower === '.gitignore') structure.hasGitignore = true;
    if (lower === 'readme.md' || lower === 'readme.txt') structure.hasReadme = true;
    if (lower === '.env.example') structure.hasEnvExample = true;

    // Security checks
    if (lower === '.env' && !lower.includes('example')) {
      securityIssues.push({
        type: 'error',
        message: `.env Datei im Projekt gefunden: ${path}`,
        recommendation: 'Niemals .env Dateien committen! Nutze .env.example stattdessen.',
      });
    }
    
    // Check for hardcoded secrets (basic check)
    if (content.includes('password') || content.includes('secret') || content.includes('api_key') || content.includes('apiKey')) {
      const hasHardcodedValue = /password\s*[:=]\s*["'][^"']+["']|secret\s*[:=]\s*["'][^"']+["']|api_?key\s*[:=]\s*["'][^"']+["']/i.test(content);
      if (hasHardcodedValue && !lower.includes('test') && !lower.includes('example')) {
        securityIssues.push({
          type: 'warning',
          message: `Mögliche hardcodierte Secrets in ${path}`,
          recommendation: 'Verwende Umgebungsvariablen für sensible Daten',
        });
      }
    }
  }

  // Calculate averages
  if (files.length > 0) {
    stats.avgFileSize = stats.totalSize / files.length;
    stats.avgLines = stats.totalLines / files.length;
  }

  // Find duplicate file names
  fileNames.forEach((count, name) => {
    if (count > 1) {
      codeQuality.duplicateNames.push(`${name} (${count}x)`);
    }
  });

  // Generate warnings
  if (!structure.hasAppTsx) {
    errors.push('App.tsx fehlt – kritisch für React Native Apps');
  }
  if (!structure.hasPackageJson) {
    errors.push('package.json fehlt – EAS/npm Builds werden fehlschlagen');
  }
  if (!structure.hasTheme) {
    warnings.push('theme.ts nicht gefunden – UI könnte inkonsistent sein');
    recommendations.push('Erstelle eine zentrale theme.ts für konsistente Styles');
  }
  if (!structure.hasTsConfig) {
    warnings.push('tsconfig.json fehlt – TypeScript-Konfiguration unklar');
    recommendations.push('Füge tsconfig.json für TypeScript-Projekte hinzu');
  }
  if (!structure.hasEslintConfig) {
    warnings.push('ESLint-Konfiguration nicht gefunden');
    recommendations.push('Richte ESLint ein für bessere Code-Qualität');
  }
  if (!structure.hasGitignore) {
    warnings.push('.gitignore fehlt');
    recommendations.push('Füge .gitignore hinzu um unnötige Dateien zu vermeiden');
  }
  if (!structure.hasReadme) {
    recommendations.push('Füge eine README.md für Projektdokumentation hinzu');
  }
  if (!structure.hasEnvExample) {
    recommendations.push('Erstelle .env.example für erforderliche Umgebungsvariablen');
  }

  // File statistics warnings
  if (stats.totalFiles === 0) {
    errors.push('Keine Projektdateien gefunden');
  }
  if (stats.totalLines > 10000) {
    warnings.push(
      `Sehr großes Projekt (~${stats.totalLines.toLocaleString()} Zeilen) – KI-Kontext könnte limitiert sein`,
    );
  }
  if (codeQuality.emptyFiles > 0) {
    warnings.push(`${codeQuality.emptyFiles} leere Datei(en) gefunden`);
  }
  if (codeQuality.filesWithManyLines > 0) {
    warnings.push(`${codeQuality.filesWithManyLines} Datei(en) mit >500 Zeilen – erwäge Refactoring`);
    recommendations.push('Teile große Dateien in kleinere Module auf');
  }
  if (codeQuality.largeFiles > 0) {
    warnings.push(`${codeQuality.largeFiles} Datei(en) >100KB – könnte Performance beeinträchtigen`);
  }
  if (codeQuality.duplicateNames.length > 0) {
    warnings.push(`Doppelte Dateinamen gefunden: ${codeQuality.duplicateNames.slice(0, 3).join(', ')}`);
    recommendations.push('Verwende eindeutige Dateinamen zur besseren Navigation');
  }

  // Dependency warnings
  if (dependencies.totalDependencies > 50) {
    warnings.push(`Viele Dependencies (${dependencies.totalDependencies}) – prüfe auf ungenutzte Pakete`);
    recommendations.push('Nutze npm-prune oder yarn autoclean für kleinere Bundle-Größen');
  }
  if (dependencies.missingScripts.length > 0) {
    warnings.push(`Fehlende npm scripts: ${dependencies.missingScripts.join(', ')}`);
  }

  // Code quality recommendations
  if (stats.tsFiles === 0 && stats.tsxFiles === 0 && stats.jsFiles > 0) {
    recommendations.push('Erwäge Migration zu TypeScript für bessere Type-Safety');
  }
  if (stats.avgLines > 200) {
    recommendations.push('Durchschnittlich große Dateien – erwäge kleinere, fokussiertere Module');
  }

  // Calculate health score (0-100)
  let healthScore = 100;
  healthScore -= errors.length * 15;
  healthScore -= warnings.length * 5;
  healthScore -= securityIssues.filter(i => i.type === 'error').length * 20;
  healthScore -= securityIssues.filter(i => i.type === 'warning').length * 10;
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    stats,
    structure,
    dependencies,
    codeQuality,
    warnings,
    errors,
    recommendations,
    securityIssues,
    healthScore,
  };
};

// Score Badge Component
const HealthScoreBadge = ({ score }: { score: number }) => {
  const getColor = () => {
    if (score >= 80) return theme.palette.success;
    if (score >= 60) return theme.palette.warning;
    return theme.palette.error;
  };

  const getLabel = () => {
    if (score >= 80) return 'Ausgezeichnet';
    if (score >= 60) return 'Gut';
    if (score >= 40) return 'Befriedigend';
    return 'Kritisch';
  };

  return (
    <View style={[styles.scoreBadge, { borderColor: getColor() }]}>
      <Text style={[styles.scoreNumber, { color: getColor() }]}>{score}</Text>
      <Text style={[styles.scoreLabel, { color: getColor() }]}>{getLabel()}</Text>
    </View>
  );
};

// Section Component
const DiagnosticSection = ({ 
  title, 
  icon, 
  children,
  error = false,
}: { 
  title: string; 
  icon: string; 
  children: React.ReactNode;
  error?: boolean;
}) => (
  <Animated.View 
    entering={FadeInDown.duration(400)} 
    style={[styles.card, error && styles.cardError]}
  >
    <View style={styles.cardHeader}>
      <Ionicons 
        name={icon as any} 
        size={20} 
        color={error ? theme.palette.error : theme.palette.primary} 
      />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </Animated.View>
);

const DiagnosticScreen: React.FC = () => {
  const { projectData, addChatMessage } = useProject();
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleRunDiagnostics = () => {
    setIsChecking(true);
    setTimeout(() => {
      try {
        const res = runAdvancedDiagnostics(projectData);
        setResult(res);
      } catch (error) {
        Alert.alert('Fehler', 'Diagnose konnte nicht durchgeführt werden');
        console.error('Diagnostic error:', error);
      } finally {
        setIsChecking(false);
      }
    }, 100);
  };

  const generateReport = useMemo(() => {
    if (!result) return '';

    const { stats, structure, dependencies, codeQuality, warnings, errors, recommendations, securityIssues, healthScore } = result;

    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════════');
    lines.push('📋 PROJEKT-DIAGNOSE REPORT');
    lines.push('═══════════════════════════════════════════════');
    lines.push('');
    lines.push(`🏥 Gesundheitsscore: ${healthScore}/100`);
    lines.push(`📅 Datum: ${new Date().toLocaleString('de-DE')}`);
    lines.push('');
    
    lines.push('📊 STATISTIKEN');
    lines.push('─────────────────────────────────────────────');
    lines.push(`• Dateien gesamt: ${stats.totalFiles}`);
    lines.push(`• Gesamtgröße: ${formatBytes(stats.totalSize)}`);
    lines.push(`• Zeilen gesamt: ${stats.totalLines.toLocaleString()}`);
    lines.push(`• Durchschn. Dateigröße: ${formatBytes(stats.avgFileSize)}`);
    lines.push(`• Durchschn. Zeilen: ${Math.round(stats.avgLines)}`);
    lines.push('');
    lines.push('Dateitypen:');
    lines.push(`  - TypeScript: ${stats.tsFiles} (.ts) + ${stats.tsxFiles} (.tsx)`);
    lines.push(`  - JavaScript: ${stats.jsFiles} (.js) + ${stats.jsxFiles} (.jsx)`);
    lines.push(`  - JSON: ${stats.jsonFiles}`);
    lines.push(`  - Markdown: ${stats.markdownFiles}`);
    lines.push(`  - Config: ${stats.configFiles}`);
    lines.push(`  - Sonstige: ${stats.otherFiles}`);
    lines.push('');
    
    if (stats.largestFile) {
      lines.push(`📈 Größte Datei: ${stats.largestFile.path}`);
      lines.push(`   ${formatBytes(stats.largestFile.size)}, ${stats.largestFile.lines} Zeilen`);
      lines.push('');
    }

    lines.push('🏗️ PROJEKT-STRUKTUR');
    lines.push('─────────────────────────────────────────────');
    lines.push(`• App.tsx: ${structure.hasAppTsx ? '✅ vorhanden' : '❌ fehlt'}`);
    lines.push(`• package.json: ${structure.hasPackageJson ? '✅ vorhanden' : '❌ fehlt'}`);
    lines.push(`• tsconfig.json: ${structure.hasTsConfig ? '✅ vorhanden' : '⚠️ fehlt'}`);
    lines.push(`• ESLint config: ${structure.hasEslintConfig ? '✅ vorhanden' : '⚠️ fehlt'}`);
    lines.push(`• theme.ts: ${structure.hasTheme ? '✅ vorhanden' : '⚠️ fehlt'}`);
    lines.push(`• .gitignore: ${structure.hasGitignore ? '✅ vorhanden' : '⚠️ fehlt'}`);
    lines.push(`• README.md: ${structure.hasReadme ? '✅ vorhanden' : '⚠️ fehlt'}`);
    lines.push(`• .env.example: ${structure.hasEnvExample ? '✅ vorhanden' : '⚠️ fehlt'}`);
    lines.push('');

    lines.push('📦 DEPENDENCIES');
    lines.push('─────────────────────────────────────────────');
    lines.push(`• Dependencies: ${dependencies.totalDependencies}`);
    lines.push(`• DevDependencies: ${dependencies.totalDevDependencies}`);
    if (dependencies.missingScripts.length > 0) {
      lines.push(`• Fehlende Scripts: ${dependencies.missingScripts.join(', ')}`);
    }
    lines.push('');

    lines.push('🎯 CODE-QUALITÄT');
    lines.push('─────────────────────────────────────────────');
    lines.push(`• Leere Dateien: ${codeQuality.emptyFiles}`);
    lines.push(`• Große Dateien (>500 Zeilen): ${codeQuality.filesWithManyLines}`);
    lines.push(`• Sehr große Dateien (>100KB): ${codeQuality.largeFiles}`);
    lines.push(`• Dateien mit langen Zeilen: ${codeQuality.filesWithLongLines}`);
    if (codeQuality.duplicateNames.length > 0) {
      lines.push(`• Doppelte Namen: ${codeQuality.duplicateNames.join(', ')}`);
    }
    lines.push('');

    if (errors.length > 0) {
      lines.push('❌ FEHLER (Kritisch)');
      lines.push('─────────────────────────────────────────────');
      errors.forEach(e => lines.push(`• ${e}`));
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push('⚠️ WARNUNGEN');
      lines.push('─────────────────────────────────────────────');
      warnings.forEach(w => lines.push(`• ${w}`));
      lines.push('');
    }

    if (securityIssues.length > 0) {
      lines.push('🔒 SICHERHEIT');
      lines.push('─────────────────────────────────────────────');
      securityIssues.forEach(issue => {
        const emoji = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`${emoji} ${issue.message}`);
        if (issue.recommendation) {
          lines.push(`   → ${issue.recommendation}`);
        }
      });
      lines.push('');
    }

    if (recommendations.length > 0) {
      lines.push('💡 EMPFEHLUNGEN');
      lines.push('─────────────────────────────────────────────');
      recommendations.forEach(r => lines.push(`• ${r}`));
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════');
    lines.push('Ende des Reports');

    return lines.join('\n');
  }, [result]);

  const handleSendToChat = () => {
    if (!result) return;

    const summary = `🔍 Projekt-Diagnose (Health Score: ${result.healthScore}/100)

📊 Zusammenfassung:
• ${result.stats.totalFiles} Dateien, ${result.stats.totalLines.toLocaleString()} Zeilen
• ${formatBytes(result.stats.totalSize)} gesamt

${result.errors.length > 0 ? `❌ ${result.errors.length} kritische Fehler\n` : ''}${result.warnings.length > 0 ? `⚠️ ${result.warnings.length} Warnungen\n` : ''}${result.securityIssues.length > 0 ? `🔒 ${result.securityIssues.length} Sicherheitshinweise\n` : ''}
👉 Bitte analysiere diesen Bericht und optimiere das Projekt entsprechend.`;

    addChatMessage({
      id: uuidv4(),
      role: 'user',
      content: summary,
      timestamp: new Date().toISOString(),
    } as any);

    Alert.alert('✅ Gesendet', 'Diagnose wurde an den Chat gesendet');
  };

  const handleExportReport = async () => {
    try {
      await Share.share({
        message: generateReport,
        title: 'Projekt-Diagnose Report',
      });
    } catch (error) {
      Alert.alert('Fehler', 'Report konnte nicht exportiert werden');
      console.error('Export error:', error);
    }
  };

  const renderStatRow = (label: string, value: string | number, highlight = false) => (
    <View style={styles.statRow} key={label}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        {String(value)}
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons
          name="medkit-outline"
          size={28}
          color={theme.palette.primary}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Erweiterte Projekt-Diagnose</Text>
          <Text style={styles.subtitle}>
            Umfassende Analyse von Struktur, Code-Qualität und Sicherheit
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Analyse starten</Text>
        <Text style={styles.cardText}>
          Detaillierte Prüfung von Dateien, Dependencies, Code-Qualität und Sicherheit.
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
              <Text style={styles.primaryButtonText}>Diagnose durchführen</Text>
            </>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSendToChat}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={16}
                color={theme.palette.primary}
              />
              <Text style={styles.secondaryButtonText}>An Chat senden</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleExportReport}
            >
              <Ionicons
                name="share-outline"
                size={16}
                color={theme.palette.primary}
              />
              <Text style={styles.secondaryButtonText}>Report teilen</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {result && (
        <>
          {/* Health Score */}
          <DiagnosticSection title="Gesundheitsscore" icon="heart-outline">
            <View style={styles.scoreContainer}>
              <HealthScoreBadge score={result.healthScore} />
              <View style={styles.scoreInfo}>
                <Text style={styles.scoreDescription}>
                  Basiert auf Struktur, Code-Qualität und Sicherheit
                </Text>
                {result.healthScore < 80 && (
                  <Text style={styles.scoreHint}>
                    💡 Behebe Fehler und Warnungen um den Score zu verbessern
                  </Text>
                )}
              </View>
            </View>
          </DiagnosticSection>

          {/* Errors */}
          {result.errors.length > 0 && (
            <DiagnosticSection title="Kritische Fehler" icon="alert-circle-outline" error>
              {result.errors.map((error, idx) => (
                <View key={idx} style={styles.issueItem}>
                  <Ionicons name="close-circle" size={16} color={theme.palette.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ))}
            </DiagnosticSection>
          )}

          {/* Security Issues */}
          {result.securityIssues.length > 0 && (
            <DiagnosticSection title="Sicherheitshinweise" icon="shield-outline">
              {result.securityIssues.map((issue, idx) => (
                <View key={idx} style={styles.securityIssue}>
                  <View style={styles.issueHeader}>
                    <Ionicons 
                      name={issue.type === 'error' ? 'alert-circle' : issue.type === 'warning' ? 'warning' : 'information-circle'} 
                      size={16} 
                      color={issue.type === 'error' ? theme.palette.error : theme.palette.warning} 
                    />
                    <Text style={[
                      styles.issueText,
                      issue.type === 'error' && styles.errorText,
                      issue.type === 'warning' && styles.warningText,
                    ]}>
                      {issue.message}
                    </Text>
                  </View>
                  {issue.recommendation && (
                    <Text style={styles.recommendation}>→ {issue.recommendation}</Text>
                  )}
                </View>
              ))}
            </DiagnosticSection>
          )}

          {/* Statistics */}
          <DiagnosticSection title="Datei-Statistiken" icon="bar-chart-outline">
            {renderStatRow('Dateien gesamt', result.stats.totalFiles)}
            {renderStatRow('Gesamtgröße', formatBytes(result.stats.totalSize))}
            {renderStatRow('Zeilen gesamt', result.stats.totalLines.toLocaleString())}
            {renderStatRow('Durchschn. Größe', formatBytes(result.stats.avgFileSize))}
            {renderStatRow('Durchschn. Zeilen', Math.round(result.stats.avgLines))}
            
            <View style={styles.divider} />
            <Text style={styles.subsectionTitle}>Dateitypen</Text>
            {renderStatRow('TypeScript (.ts)', result.stats.tsFiles)}
            {renderStatRow('TSX (.tsx)', result.stats.tsxFiles)}
            {renderStatRow('JavaScript (.js)', result.stats.jsFiles)}
            {renderStatRow('JSX (.jsx)', result.stats.jsxFiles)}
            {renderStatRow('JSON', result.stats.jsonFiles)}
            {renderStatRow('Markdown', result.stats.markdownFiles)}
            {renderStatRow('Config', result.stats.configFiles)}
            {renderStatRow('Sonstige', result.stats.otherFiles)}

            {result.stats.largestFile && (
              <>
                <View style={styles.divider} />
                <Text style={styles.subsectionTitle}>Größte Datei</Text>
                <Text style={styles.fileDetail}>{result.stats.largestFile.path}</Text>
                <Text style={styles.fileDetailSub}>
                  {formatBytes(result.stats.largestFile.size)} • {result.stats.largestFile.lines} Zeilen
                </Text>
              </>
            )}
          </DiagnosticSection>

          {/* Structure */}
          <DiagnosticSection title="Projekt-Struktur" icon="file-tray-outline">
            <View style={styles.structureGrid}>
              {[
                { label: 'App.tsx', value: result.structure.hasAppTsx },
                { label: 'package.json', value: result.structure.hasPackageJson },
                { label: 'tsconfig.json', value: result.structure.hasTsConfig },
                { label: 'ESLint config', value: result.structure.hasEslintConfig },
                { label: 'theme.ts', value: result.structure.hasTheme },
                { label: '.gitignore', value: result.structure.hasGitignore },
                { label: 'README.md', value: result.structure.hasReadme },
                { label: '.env.example', value: result.structure.hasEnvExample },
              ].map(item => (
                <View key={item.label} style={styles.structureItem}>
                  <Ionicons 
                    name={item.value ? 'checkmark-circle' : 'close-circle'} 
                    size={18} 
                    color={item.value ? theme.palette.success : theme.palette.text.muted} 
                  />
                  <Text style={[styles.structureLabel, !item.value && styles.structureLabelMissing]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </DiagnosticSection>

          {/* Dependencies */}
          <DiagnosticSection title="Dependencies" icon="cube-outline">
            {renderStatRow('Dependencies', result.dependencies.totalDependencies)}
            {renderStatRow('DevDependencies', result.dependencies.totalDevDependencies)}
            {result.dependencies.missingScripts.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.subsectionTitle}>Fehlende npm Scripts</Text>
                {result.dependencies.missingScripts.map(script => (
                  <Text key={script} style={styles.missingScript}>• {script}</Text>
                ))}
              </>
            )}
          </DiagnosticSection>

          {/* Code Quality */}
          <DiagnosticSection title="Code-Qualität" icon="code-slash-outline">
            {renderStatRow('Leere Dateien', result.codeQuality.emptyFiles, result.codeQuality.emptyFiles > 0)}
            {renderStatRow('Große Dateien (>500 Zeilen)', result.codeQuality.filesWithManyLines, result.codeQuality.filesWithManyLines > 0)}
            {renderStatRow('Sehr große Dateien (>100KB)', result.codeQuality.largeFiles, result.codeQuality.largeFiles > 0)}
            {renderStatRow('Dateien mit langen Zeilen', result.codeQuality.filesWithLongLines, result.codeQuality.filesWithLongLines > 0)}
            
            {result.codeQuality.duplicateNames.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.subsectionTitle}>Doppelte Dateinamen</Text>
                {result.codeQuality.duplicateNames.slice(0, 5).map(name => (
                  <Text key={name} style={styles.duplicateName}>• {name}</Text>
                ))}
              </>
            )}
          </DiagnosticSection>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <DiagnosticSection title="Warnungen" icon="warning-outline">
              {result.warnings.map((warning, idx) => (
                <View key={idx} style={styles.issueItem}>
                  <Ionicons name="warning" size={16} color={theme.palette.warning} />
                  <Text style={styles.warningText}>{warning}</Text>
                </View>
              ))}
            </DiagnosticSection>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <DiagnosticSection title="Empfehlungen" icon="bulb-outline">
              {result.recommendations.map((rec, idx) => (
                <View key={idx} style={styles.issueItem}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={theme.palette.primary} />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </DiagnosticSection>
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
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cardError: {
    borderColor: theme.palette.error,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  cardText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: theme.palette.background,
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderColor: theme.palette.primary,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: theme.palette.primary,
    fontSize: 13,
    fontWeight: '500',
  },

  // Health Score
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderRadius: 60,
    width: 100,
    height: 100,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  scoreInfo: {
    flex: 1,
    gap: 8,
  },
  scoreDescription: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    lineHeight: 18,
  },
  scoreHint: {
    fontSize: 12,
    color: theme.palette.text.accent,
    lineHeight: 16,
  },

  // Stats
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.palette.text.primary,
  },
  statValueHighlight: {
    color: theme.palette.warning,
    fontWeight: '600',
  },

  // Structure
  structureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  structureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
  },
  structureLabel: {
    fontSize: 13,
    color: theme.palette.text.primary,
  },
  structureLabelMissing: {
    color: theme.palette.text.muted,
  },

  // Issues
  issueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  issueText: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.text.primary,
    lineHeight: 18,
  },
  errorText: {
    color: theme.palette.error,
  },
  warningText: {
    color: theme.palette.warning,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.text.secondary,
    lineHeight: 18,
  },

  // Security
  securityIssue: {
    marginTop: 8,
    gap: 6,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recommendation: {
    fontSize: 12,
    color: theme.palette.text.muted,
    marginLeft: 24,
    fontStyle: 'italic',
  },

  // Misc
  divider: {
    height: 1,
    backgroundColor: theme.palette.border,
    marginVertical: 12,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginTop: 4,
    marginBottom: 8,
  },
  fileDetail: {
    fontSize: 12,
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
  },
  fileDetailSub: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  missingScript: {
    fontSize: 13,
    color: theme.palette.warning,
    marginTop: 2,
  },
  duplicateName: {
    fontSize: 13,
    color: theme.palette.warning,
    marginTop: 2,
  },
});
