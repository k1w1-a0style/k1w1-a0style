// screens/DiagnosticScreen.tsx – Erweiterte Fehlersuche & Projekt-Check
// ✅ VERBESSERT: Mehr Checks, Fix-All, Expo SDK Detection, Dependency Analyse

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { validateProjectFiles } from '../utils/chatUtils';
import { validateSyntax, validateCodeQuality } from '../utils/syntaxValidator';
import { ProjectFile } from '../contexts/types';
import { useNavigation } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings?: string[];
};

type DiagnosticIssue = {
  type: 'error' | 'warning' | 'info';
  source: string; // 'eslint' | 'typescript' | 'expo-doctor' | 'code-quality' | 'syntax' | 'dependency' | 'security'
  file?: string;
  line?: number;
  message: string;
  code?: string;
  fixable?: boolean;
  priority?: 'high' | 'medium' | 'low';
};

// ✅ NEU: Bekannte veraltete/problematische Pakete
const KNOWN_OUTDATED_PACKAGES: Record<string, { latest: string; reason: string }> = {
  'react-native-gesture-handler': { latest: '^2.14.0', reason: 'Breaking changes in älteren Versionen' },
  'react-navigation': { latest: '@react-navigation/native', reason: 'Deprecated - use @react-navigation' },
  'expo-app-loading': { latest: 'expo-splash-screen', reason: 'Deprecated in SDK 46+' },
  'moment': { latest: 'date-fns or dayjs', reason: 'Große Bundle-Size, besser Alternativen nutzen' },
};

// ✅ NEU: Sicherheits-Checks
const SECURITY_PATTERNS = [
  { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{10,}['"]/gi, message: 'Möglicher API-Key im Code gefunden' },
  { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, message: 'Mögliches Passwort im Code gefunden' },
  { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/gi, message: 'Mögliches Secret im Code gefunden' },
  { pattern: /eval\s*\(/g, message: 'eval() ist ein Sicherheitsrisiko' },
  { pattern: /dangerouslySetInnerHTML/g, message: 'dangerouslySetInnerHTML kann XSS ermöglichen' },
];

type DiagnosticReport = {
  stats: {
    totalFiles: number;
    totalLines: number;
    totalSize: number;
    largestFile: string;
    componentCount: number;
    screenCount: number;
    hookCount: number;
    contextCount: number;
  };
  structure: {
    hasAppTsx: boolean;
    hasPackageJson: boolean;
    hasTheme: boolean;
    hasGitignore: boolean;
    hasReadme: boolean;
    hasTypeScriptConfig: boolean;
    hasEslintConfig: boolean;
    hasAppConfig: boolean;
    hasBabelConfig: boolean;
  };
  // ✅ NEU: Expo-spezifische Infos
  expo: {
    sdkVersion: string | null;
    projectName: string | null;
    bundleId: string | null;
    androidPackage: string | null;
    hasEasConfig: boolean;
  };
  validation: ValidationResult;
  issues: DiagnosticIssue[];
  dependencies: {
    total: number;
    outdated: string[];
    missing: string[];
    deprecated: string[];
    security: string[];
  };
  performance: {
    filesOver500Lines: string[];
    duplicateCode: string[];
    unusedComponents: string[];
    circularImports: string[];
  };
};

const DiagnosticScreen: React.FC = () => {
  const { projectData, triggerAutoFix } = useProject();
  const navigation = useNavigation();
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());

  // ✅ FIXED: Funktion sendet Fix-Request und triggert KI automatisch
  const sendIssueToChat = useCallback((issue: DiagnosticIssue) => {
    const messageContent = `🔧 Fix Request: ${issue.source}\n\n` +
      `**Typ**: ${issue.type}\n` +
      (issue.file ? `**Datei**: ${issue.file}\n` : '') +
      (issue.line ? `**Zeile**: ${issue.line}\n` : '') +
      `**Problem**: ${issue.message}\n` +
      (issue.code ? `\n**Code**: ${issue.code}\n` : '') +
      `\nBitte behebe diesen Fehler und erkläre die Änderungen.`;

    // ✅ NEU: Trigger Auto-Fix - KI wird automatisch antworten
    triggerAutoFix(messageContent);

    // Navigate to Home (Tab Navigator) which contains Chat
    navigation.navigate('Home' as never);
    Alert.alert(
      '🤖 Auto-Fix gestartet',
      'Die KI analysiert das Problem und wird automatisch eine Lösung vorschlagen.',
      [{ text: 'OK' }]
    );
  }, [triggerAutoFix, navigation]);

  // ✅ NEU: Mehrere Issues gleichzeitig fixen
  const sendMultipleIssuesToChat = useCallback((issues: DiagnosticIssue[]) => {
    if (issues.length === 0) {
      Alert.alert('Keine Issues ausgewählt', 'Bitte wähle mindestens ein Issue zum Fixen aus.');
      return;
    }

    const messageContent = `🔧 Multi-Fix Request: ${issues.length} Probleme\n\n` +
      issues.map((issue, idx) => 
        `### Problem ${idx + 1}: ${issue.source}\n` +
        `**Typ**: ${issue.type}\n` +
        (issue.file ? `**Datei**: ${issue.file}\n` : '') +
        (issue.line ? `**Zeile**: ${issue.line}\n` : '') +
        `**Problem**: ${issue.message}\n` +
        (issue.code ? `**Code**: \`${issue.code}\`\n` : '')
      ).join('\n---\n\n') +
      `\n\nBitte behebe alle diese Fehler und erkläre die Änderungen.`;

    triggerAutoFix(messageContent);
    navigation.navigate('Home' as never);
    setSelectedIssues(new Set());
    Alert.alert(
      '🤖 Multi-Fix gestartet',
      `Die KI analysiert ${issues.length} Probleme und wird automatisch Lösungen vorschlagen.`,
      [{ text: 'OK' }]
    );
  }, [triggerAutoFix, navigation]);

  // ✅ NEU: Toggle Issue-Selektion
  const toggleIssueSelection = useCallback((index: number) => {
    setSelectedIssues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // ✅ NEU: Alle fixbaren Issues auswählen
  const selectAllFixable = useCallback(() => {
    if (!report) return;
    const fixableIndices = report.issues
      .map((issue, idx) => issue.fixable ? idx : -1)
      .filter(idx => idx !== -1);
    setSelectedIssues(new Set(fixableIndices));
  }, [report]);

  const runDiagnostic = useCallback(async () => {
    setIsAnalyzing(true);
    setSelectedIssues(new Set());
    
    try {
      const files: ProjectFile[] = projectData?.files ?? [];
      const issues: DiagnosticIssue[] = [];

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
      // ✅ NEU: Hook und Context Zählung
      const hookCount = files.filter(
        (f) => f.path.includes('/hooks/') || f.path.startsWith('hooks/') || 
               (f.path.match(/use[A-Z]/) !== null)
      ).length;
      const contextCount = files.filter(
        (f) => f.path.includes('/contexts/') || f.path.startsWith('contexts/') ||
               f.path.includes('Context')
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
        hookCount,
        contextCount,
      };

      // Enhanced structure checks
      const structure = {
        hasAppTsx: files.some((f) => f.path === 'App.tsx'),
        hasPackageJson: files.some((f) => f.path === 'package.json'),
        hasTheme: files.some((f) => f.path === 'theme.ts' || f.path === 'theme.tsx'),
        hasGitignore: files.some((f) => f.path === '.gitignore'),
        hasReadme: files.some((f) => f.path === 'README.md'),
        hasTypeScriptConfig: files.some((f) => f.path === 'tsconfig.json'),
        hasEslintConfig: files.some((f) => 
          f.path === 'eslint.config.js' || 
          f.path === '.eslintrc.js' || 
          f.path === '.eslintrc.json'
        ),
        hasAppConfig: files.some((f) => f.path === 'app.config.js' || f.path === 'app.json'),
        hasBabelConfig: files.some((f) => f.path === 'babel.config.js'),
      };

      // ✅ NEU: Expo-spezifische Analyse
      let expo = {
        sdkVersion: null as string | null,
        projectName: null as string | null,
        bundleId: null as string | null,
        androidPackage: null as string | null,
        hasEasConfig: files.some((f) => f.path === 'eas.json'),
      };

      const pkgFile = files.find((f) => f.path === 'package.json');
      const appConfigFile = files.find((f) => f.path === 'app.config.js' || f.path === 'app.json');

      if (pkgFile) {
        try {
          const pkg = JSON.parse(String(pkgFile.content));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Expo SDK Version Detection
          if (deps.expo) {
            const expoVersion = deps.expo.replace(/[^0-9.]/g, '');
            expo.sdkVersion = expoVersion.split('.')[0];
          }

          // ✅ NEU: Deprecated Package Detection
          Object.entries(deps).forEach(([depName, version]) => {
            if (KNOWN_OUTDATED_PACKAGES[depName]) {
              issues.push({
                type: 'warning',
                source: 'dependency',
                file: 'package.json',
                message: `"${depName}" ist deprecated. ${KNOWN_OUTDATED_PACKAGES[depName].reason}. Empfehlung: ${KNOWN_OUTDATED_PACKAGES[depName].latest}`,
                fixable: true,
                priority: 'medium',
              });
            }
          });

          // ✅ NEU: Check for very old dependencies
          const majorVersionPattern = /^\^?~?(\d+)/;
          if (deps.react) {
            const reactMajor = deps.react.match(majorVersionPattern)?.[1];
            if (reactMajor && parseInt(reactMajor) < 18) {
              issues.push({
                type: 'warning',
                source: 'dependency',
                file: 'package.json',
                message: `React ${deps.react} ist veraltet. React 18+ empfohlen.`,
                fixable: true,
                priority: 'high',
              });
            }
          }

        } catch (e) {
          issues.push({
            type: 'error',
            source: 'validation',
            file: 'package.json',
            message: 'package.json konnte nicht geparst werden',
            fixable: true,
            priority: 'high',
          });
        }
      }

      // ✅ NEU: app.config.js Analyse
      if (appConfigFile) {
        const configContent = String(appConfigFile.content);
        
        // Check for required Expo config fields
        if (!configContent.includes('expo:') && !configContent.includes('"expo"')) {
          issues.push({
            type: 'error',
            source: 'expo-doctor',
            file: appConfigFile.path,
            message: 'app.config.js muss ein "expo" Objekt exportieren',
            fixable: true,
            priority: 'high',
          });
        }

        // Extract project name
        const nameMatch = configContent.match(/name:\s*['"]([^'"]+)['"]/);
        if (nameMatch) expo.projectName = nameMatch[1];

        // Check bundle identifiers
        const bundleIdMatch = configContent.match(/bundleIdentifier:\s*['"]([^'"]+)['"]/);
        if (bundleIdMatch) expo.bundleId = bundleIdMatch[1];

        const packageMatch = configContent.match(/package:\s*['"]([^'"]+)['"]/);
        if (packageMatch) expo.androidPackage = packageMatch[1];

        // ✅ NEU: Validate Android Package Name
        if (expo.androidPackage) {
          if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(expo.androidPackage)) {
            issues.push({
              type: 'error',
              source: 'expo-doctor',
              file: appConfigFile.path,
              message: `Android Package Name "${expo.androidPackage}" ist ungültig. Format: com.example.app`,
              fixable: true,
              priority: 'high',
            });
          }
        } else {
          issues.push({
            type: 'warning',
            source: 'expo-doctor',
            file: appConfigFile.path,
            message: 'Kein Android Package Name definiert (android.package)',
            fixable: true,
            priority: 'medium',
          });
        }

        // Check for EAS Project ID
        if (!configContent.includes('projectId') && !configContent.includes('EAS_PROJECT_ID')) {
          issues.push({
            type: 'info',
            source: 'expo-doctor',
            file: appConfigFile.path,
            message: 'Kein EAS Project ID konfiguriert - für EAS Builds benötigt',
            fixable: true,
            priority: 'low',
          });
        }
      }

      const validation =
        (validateProjectFiles(files) as ValidationResult) ?? {
          valid: true,
          errors: [],
        };

      // Add validation errors as issues
      validation.errors?.forEach((err) => {
        issues.push({
          type: 'error',
          source: 'validation',
          message: err,
          fixable: false,
          priority: 'high',
        });
      });

      validation.warnings?.forEach((warn) => {
        issues.push({
          type: 'warning',
          source: 'validation',
          message: warn,
          fixable: false,
          priority: 'medium',
        });
      });

      const filesOver500Lines: string[] = [];
      const unusedComponents: string[] = [];
      const circularImports: string[] = [];

      // ✅ NEU: Import-Map für Zirkularitäts-Erkennung
      const importMap = new Map<string, string[]>();

      // Enhanced code issue detection
      files.forEach((file) => {
        const { path, content } = file;
        const text = String(content ?? '');

        if (!text.trim()) return;

        const lines = text.split('\n');
        
        // Check file size
        if (lines.length > 500) {
          filesOver500Lines.push(`${path} (${lines.length} Zeilen)`);
          issues.push({
            type: 'warning',
            source: 'code-quality',
            file: path,
            message: `Datei ist sehr groß (${lines.length} Zeilen). Überprüfe ob Refactoring sinnvoll ist.`,
            fixable: true,
            priority: 'low',
          });
        }

        // ✅ NEU: Security Checks
        SECURITY_PATTERNS.forEach(({ pattern, message }) => {
          const regex = new RegExp(pattern);
          if (regex.test(text)) {
            issues.push({
              type: 'error',
              source: 'security',
              file: path,
              message: `⚠️ Sicherheit: ${message}`,
              fixable: true,
              priority: 'high',
            });
          }
        });

        // ✅ NEU: Import-Analyse
        const importMatches = text.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
        const imports: string[] = [];
        for (const match of importMatches) {
          imports.push(match[1]);
        }
        importMap.set(path, imports);

        // Syntax & Quality validation
        const syntaxErrors = validateSyntax(text, path);
        const qualityErrors = validateCodeQuality(text, path);
        
        syntaxErrors.forEach((err) => {
          issues.push({
            type: err.severity === 'error' ? 'error' : 'warning',
            source: 'syntax',
            file: path,
            line: err.line,
            message: err.message,
            code: err.code,
            fixable: true,
            priority: err.severity === 'error' ? 'high' : 'medium',
          });
        });

        qualityErrors.forEach((err) => {
          issues.push({
            type: err.severity === 'error' ? 'error' : 'warning',
            source: 'code-quality',
            file: path,
            line: err.line,
            message: err.message,
            code: err.code,
            fixable: true,
            priority: err.severity === 'error' ? 'high' : 'medium',
          });
        });

        // TypeScript specific checks
        if (path.endsWith('.ts') || path.endsWith('.tsx')) {
          // Check for common TS issues
          if (text.includes('any') && !text.includes('// @ts-ignore')) {
            const anyCount = (text.match(/:\s*any/g) || []).length;
            if (anyCount > 3) {
              issues.push({
                type: 'warning',
                source: 'typescript',
                file: path,
                message: `Datei enthält ${anyCount} 'any' Typen. Typsicherheit verbessern.`,
                fixable: true,
                priority: 'medium',
              });
            }
          }

          // Check for missing type imports
          if (text.includes('React.FC') && !text.includes("import React")) {
            issues.push({
              type: 'error',
              source: 'typescript',
              file: path,
              message: 'React.FC verwendet aber React nicht importiert',
              fixable: true,
              priority: 'high',
            });
          }

          // ✅ NEU: Check for @ts-ignore without explanation
          const tsIgnoreCount = (text.match(/@ts-ignore(?!\s*\w)/g) || []).length;
          if (tsIgnoreCount > 0) {
            issues.push({
              type: 'warning',
              source: 'typescript',
              file: path,
              message: `${tsIgnoreCount}x @ts-ignore ohne Erklärung gefunden`,
              fixable: true,
              priority: 'medium',
            });
          }
        }

        // ESLint-style checks
        if (text.includes('console.log') && !path.includes('test')) {
          issues.push({
            type: 'warning',
            source: 'eslint',
            file: path,
            message: 'console.log gefunden - sollte vor Production entfernt werden',
            fixable: true,
            priority: 'low',
          });
        }

        // ✅ NEU: Check for TODO/FIXME comments
        const todoCount = (text.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi) || []).length;
        if (todoCount > 2) {
          issues.push({
            type: 'info',
            source: 'code-quality',
            file: path,
            message: `${todoCount} TODO/FIXME Kommentare gefunden`,
            fixable: false,
            priority: 'low',
          });
        }

        // Check for unused components
        if ((path.includes('/components/') || path.startsWith('components/')) &&
            !path.endsWith('.test.tsx') &&
            !path.endsWith('.test.ts')) {
          const componentName = path.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '');
          if (componentName) {
            const isUsed = files.some((f) => 
              f.path !== path && String(f.content).includes(componentName)
            );
            if (!isUsed) {
              unusedComponents.push(path);
              issues.push({
                type: 'info',
                source: 'code-quality',
                file: path,
                message: `Komponente wird möglicherweise nicht verwendet`,
                fixable: false,
                priority: 'low',
              });
            }
          }
        }
      });

      // Check dependencies
      let dependencies = {
        total: 0,
        outdated: [] as string[],
        missing: [] as string[],
        deprecated: [] as string[],
        security: [] as string[],
      };

      if (pkgFile) {
        try {
          const pkg = JSON.parse(String(pkgFile.content));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          dependencies.total = Object.keys(deps).length;
        } catch (e) {
          // Already handled above
        }
      }

      // Expo Doctor check
      if (!structure.hasAppTsx) {
        issues.push({
          type: 'error',
          source: 'expo-doctor',
          message: 'App.tsx fehlt - Haupteinstiegspunkt der App nicht gefunden',
          fixable: true,
          priority: 'high',
        });
      }

      if (!structure.hasPackageJson) {
        issues.push({
          type: 'error',
          source: 'expo-doctor',
          message: 'package.json fehlt - Projekt ist nicht korrekt konfiguriert',
          fixable: true,
          priority: 'high',
        });
      }

      if (!structure.hasEslintConfig) {
        issues.push({
          type: 'info',
          source: 'eslint',
          message: 'ESLint-Konfiguration fehlt - Code-Qualitätscheck nicht verfügbar',
          fixable: true,
          priority: 'low',
        });
      }

      if (!structure.hasBabelConfig) {
        issues.push({
          type: 'info',
          source: 'expo-doctor',
          message: 'babel.config.js fehlt - Standard Babel-Konfiguration wird verwendet',
          fixable: true,
          priority: 'low',
        });
      }

      // ✅ Sort issues by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      issues.sort((a, b) => {
        const typeOrder = { error: 0, warning: 1, info: 2 };
        const typeDiff = typeOrder[a.type] - typeOrder[b.type];
        if (typeDiff !== 0) return typeDiff;
        return (priorityOrder[a.priority || 'low'] || 2) - (priorityOrder[b.priority || 'low'] || 2);
      });

      setReport({
        stats,
        structure,
        expo,
        validation,
        issues,
        dependencies,
        performance: {
          filesOver500Lines,
          duplicateCode: [],
          unusedComponents,
          circularImports,
        },
      });
    } catch (error) {
      Alert.alert('Fehler', 'Analyse fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsAnalyzing(false);
    }
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
    return report.issues.length > 0;
  }, [report]);

  const issuesByType = useMemo(() => {
    if (!report) return { errors: [], warnings: [], info: [] };
    return {
      errors: report.issues.filter(i => i.type === 'error'),
      warnings: report.issues.filter(i => i.type === 'warning'),
      info: report.issues.filter(i => i.type === 'info'),
    };
  }, [report]);

  const renderIssue = (issue: DiagnosticIssue, index: number) => {
    const isSelected = selectedIssues.has(index);
    
    return (
      <View key={index} style={[styles.issueCard, isSelected && styles.issueCardSelected]}>
        <View style={styles.issueHeader}>
          <View style={styles.issueHeaderLeft}>
            {/* ✅ NEU: Checkbox für Multi-Fix */}
            {issue.fixable && (
              <TouchableOpacity
                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                onPress={() => toggleIssueSelection(index)}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={14} color={theme.palette.background} />
                )}
              </TouchableOpacity>
            )}
            <Ionicons
              name={
                issue.type === 'error' ? 'close-circle' :
                issue.type === 'warning' ? 'warning' : 'information-circle'
              }
              size={20}
              color={
                issue.type === 'error' ? theme.palette.error :
                issue.type === 'warning' ? theme.palette.warning : theme.palette.primary
              }
            />
            <Text style={[
              styles.issueSource,
              issue.type === 'error' && styles.issueSourceError,
              issue.type === 'warning' && styles.issueSourceWarning,
            ]}>
              {issue.source.toUpperCase()}
            </Text>
            {/* ✅ NEU: Priority Badge */}
            {issue.priority && issue.priority !== 'low' && (
              <View style={[
                styles.priorityBadge,
                issue.priority === 'high' && styles.priorityHigh,
                issue.priority === 'medium' && styles.priorityMedium,
              ]}>
                <Text style={styles.priorityText}>
                  {issue.priority === 'high' ? '!' : '•'}
                </Text>
              </View>
            )}
          </View>
          {issue.fixable && (
            <TouchableOpacity
              style={styles.fixButton}
              onPress={() => sendIssueToChat(issue)}
            >
              <Ionicons name="construct" size={16} color={theme.palette.primary} />
              <Text style={styles.fixButtonText}>Fix</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {issue.file && (
          <Text style={styles.issueFile}>
            📄 {issue.file}{issue.line ? `:${issue.line}` : ''}
          </Text>
        )}
        
        <Text style={[
          styles.issueMessage,
          issue.type === 'error' && styles.issueMessageError,
          issue.type === 'warning' && styles.issueMessageWarning,
        ]}>
          {issue.message}
        </Text>
        
        {issue.code && (
          <View style={styles.issueCodeBox}>
            <Text style={styles.issueCode}>{issue.code}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Ionicons name="fitness-outline" size={32} color={theme.palette.primary} />
          <View style={styles.headerText}>
            <Text style={styles.title}>🔍 Projekt-Diagnose</Text>
            <Text style={styles.subtitle}>
              ESLint, TypeScript, Expo Doctor, Code-Qualität & Performance
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
              <Text style={styles.buttonText}>Vollständige Analyse starten</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ✅ NEU: Multi-Fix Buttons */}
        {report && report.issues.filter(i => i.fixable).length > 0 && (
          <View style={styles.multiFixContainer}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={selectAllFixable}
            >
              <Ionicons name="checkbox-outline" size={16} color={theme.palette.primary} />
              <Text style={styles.selectAllText}>Alle auswählen</Text>
            </TouchableOpacity>
            
            {selectedIssues.size > 0 && (
              <TouchableOpacity
                style={styles.fixAllButton}
                onPress={() => {
                  const selectedIssuesList = report.issues.filter((_, idx) => selectedIssues.has(idx));
                  sendMultipleIssuesToChat(selectedIssuesList);
                }}
              >
                <Ionicons name="hammer" size={16} color={theme.palette.background} />
                <Text style={styles.fixAllText}>
                  {selectedIssues.size} Issues fixen
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      {!report && (
        <View style={styles.emptyState}>
          <Ionicons name="flask-outline" size={64} color={theme.palette.text.secondary} />
          <Text style={styles.emptyTitle}>Bereit für Diagnose</Text>
          <Text style={styles.emptyText}>
            Starte die Analyse um detaillierte Informationen über dein Projekt zu erhalten.
          </Text>
        </View>
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
                {hasIssues ? '⚠️ Probleme gefunden' : '✅ Projekt gesund'}
              </Text>
              <Text style={styles.healthSubtitle}>
                {hasIssues
                  ? `${issuesByType.errors.length} Fehler, ${issuesByType.warnings.length} Warnungen, ${issuesByType.info.length} Infos`
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
            {renderStatRow('Hooks', String(report.stats.hookCount))}
            {renderStatRow('Contexts', String(report.stats.contextCount))}

            {/* ✅ NEU: Expo Info Section */}
            <Text style={styles.sectionTitle}>📱 Expo</Text>
            {renderStatRow('SDK Version', report.expo.sdkVersion ? `SDK ${report.expo.sdkVersion}` : 'Nicht erkannt')}
            {renderStatRow('Projektname', report.expo.projectName || 'Nicht definiert')}
            {renderStatRow('iOS Bundle ID', report.expo.bundleId || 'Nicht definiert')}
            {renderStatRow('Android Package', report.expo.androidPackage || 'Nicht definiert')}
            {renderStatRow('EAS Konfiguration', renderBool(report.expo.hasEasConfig))}

            <Text style={styles.sectionTitle}>📦 Dependencies</Text>
            {renderStatRow('Gesamt', String(report.dependencies.total))}
            {report.dependencies.deprecated.length > 0 && 
              renderStatRow('Deprecated', String(report.dependencies.deprecated.length))}

            <Text style={styles.sectionTitle}>✅ Projekt-Struktur</Text>
            {renderStatRow('App.tsx', renderBool(report.structure.hasAppTsx))}
            {renderStatRow('package.json', renderBool(report.structure.hasPackageJson))}
            {renderStatRow('app.config.js', renderBool(report.structure.hasAppConfig))}
            {renderStatRow('babel.config.js', renderBool(report.structure.hasBabelConfig))}
            {renderStatRow('theme.ts', renderBool(report.structure.hasTheme))}
            {renderStatRow('.gitignore', renderBool(report.structure.hasGitignore))}
            {renderStatRow('README.md', renderBool(report.structure.hasReadme))}
            {renderStatRow('tsconfig.json', renderBool(report.structure.hasTypeScriptConfig))}
            {renderStatRow('ESLint Config', renderBool(report.structure.hasEslintConfig))}
          </View>

          {/* Errors Section */}
          {issuesByType.errors.length > 0 && (
            <View style={styles.issuesSection}>
              <View style={styles.issuesSectionHeader}>
                <Ionicons name="close-circle" size={24} color={theme.palette.error} />
                <Text style={[styles.sectionTitle, styles.sectionTitleError]}>
                  🚨 Fehler ({issuesByType.errors.length})
                </Text>
              </View>
              {issuesByType.errors.slice(0, 10).map(renderIssue)}
              {issuesByType.errors.length > 10 && (
                <Text style={styles.moreIssuesText}>
                  ... und {issuesByType.errors.length - 10} weitere Fehler
                </Text>
              )}
            </View>
          )}

          {/* Warnings Section */}
          {issuesByType.warnings.length > 0 && (
            <View style={styles.issuesSection}>
              <View style={styles.issuesSectionHeader}>
                <Ionicons name="warning" size={24} color={theme.palette.warning} />
                <Text style={[styles.sectionTitle, styles.sectionTitleWarning]}>
                  ⚠️ Warnungen ({issuesByType.warnings.length})
                </Text>
              </View>
              {issuesByType.warnings.slice(0, 10).map(renderIssue)}
              {issuesByType.warnings.length > 10 && (
                <Text style={styles.moreIssuesText}>
                  ... und {issuesByType.warnings.length - 10} weitere Warnungen
                </Text>
              )}
            </View>
          )}

          {/* Info Section */}
          {issuesByType.info.length > 0 && (
            <View style={styles.issuesSection}>
              <View style={styles.issuesSectionHeader}>
                <Ionicons name="information-circle" size={24} color={theme.palette.primary} />
                <Text style={[styles.sectionTitle, styles.sectionTitleInfo]}>
                  💡 Hinweise ({issuesByType.info.length})
                </Text>
              </View>
              {issuesByType.info.slice(0, 10).map(renderIssue)}
              {issuesByType.info.length > 10 && (
                <Text style={styles.moreIssuesText}>
                  ... und {issuesByType.info.length - 10} weitere Hinweise
                </Text>
              )}
            </View>
          )}

          {!hasIssues && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color={theme.palette.success} />
              <Text style={styles.successTitle}>Alles in Ordnung! 🎉</Text>
              <Text style={styles.successText}>
                Keine Fehler oder Warnungen gefunden. Dein Projekt ist sauber.
              </Text>
            </View>
          )}
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
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
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
  reportBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
  },
  sectionTitleError: {
    color: theme.palette.error,
  },
  sectionTitleWarning: {
    color: theme.palette.warning,
  },
  sectionTitleInfo: {
    color: theme.palette.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
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
  issuesSection: {
    marginBottom: 16,
  },
  issuesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  issueCard: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  // ✅ NEU: Multi-Fix Styles
  multiFixContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  selectAllText: {
    fontSize: 13,
    color: theme.palette.primary,
    fontWeight: '500',
  },
  fixAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.palette.primary,
  },
  fixAllText: {
    fontSize: 13,
    color: theme.palette.background,
    fontWeight: '600',
  },
  // ✅ NEU: Checkbox Styles
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  checkboxSelected: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  issueCardSelected: {
    borderColor: theme.palette.primary,
    backgroundColor: `${theme.palette.primary}10`,
  },
  // ✅ NEU: Priority Badge Styles
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  priorityHigh: {
    backgroundColor: theme.palette.error,
  },
  priorityMedium: {
    backgroundColor: theme.palette.warning,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  issueSource: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.palette.text.secondary,
    letterSpacing: 0.5,
  },
  issueSourceError: {
    color: theme.palette.error,
  },
  issueSourceWarning: {
    color: theme.palette.warning,
  },
  fixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${theme.palette.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  fixButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.palette.primary,
  },
  issueFile: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  issueMessage: {
    fontSize: 13,
    color: theme.palette.text.primary,
    lineHeight: 18,
  },
  issueMessageError: {
    color: theme.palette.error,
  },
  issueMessageWarning: {
    color: theme.palette.warning,
  },
  issueCodeBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: theme.palette.background,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  issueCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: theme.palette.text.secondary,
  },
  moreIssuesText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  successBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: `${theme.palette.success}10`,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.palette.success,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.success,
    marginTop: 12,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
