import React, { useCallback, useMemo, useState } from 'react';
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
import { validateFilePath } from '../utils/chatUtils';

type DiagnosticIssue = {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  file?: string;
  message: string;
  fixable?: boolean;
  priority?: 'high' | 'medium' | 'low';
};

type DiagnosticReport = {
  timestamp: string;
  issues: DiagnosticIssue[];
};

export default function DiagnosticScreen() {
  const { projectData, triggerAutoFix } = useProject();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const runDiagnostic = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const files = projectData?.files ?? [];
      const issues: DiagnosticIssue[] = [];

      if (!files.length) {
        issues.push({
          id: 'no-files',
          type: 'error',
          category: 'Projekt',
          message: 'Keine Projektdateien gefunden.',
          fixable: false,
          priority: 'high',
        });
      }

      // Beispiel-Checks (du kannst hier deine bestehenden Checks reinziehen)
      const appConfig = files.find((f) => f.path === 'app.config.js');
      if (!appConfig) {
        issues.push({
          id: 'missing-app-config',
          type: 'error',
          category: 'Expo',
          file: 'app.config.js',
          message: 'app.config.js fehlt.',
          fixable: true,
          priority: 'high',
        });

      // Weitere sinnvolle Checks
      const tsconfig = files.find((f) => f.path === 'tsconfig.json');
      if (!tsconfig) {
        issues.push({
          id: 'missing-tsconfig',
          type: 'warning',
          category: 'TypeScript',
          file: 'tsconfig.json',
          message: 'tsconfig.json fehlt (TypeScript-Check/IDE-Unterstützung wird schlechter).',
          fixable: true,
          priority: 'medium',
        });
      }

      const eslintConfig =
        files.find((f) => f.path === '.eslintrc') ||
        files.find((f) => f.path === '.eslintrc.js') ||
        files.find((f) => f.path === '.eslintrc.cjs') ||
        files.find((f) => f.path === '.eslintrc.json') ||
        files.find((f) => f.path === 'eslint.config.js') ||
        files.find((f) => f.path === 'eslint.config.cjs');

      if (!eslintConfig) {
        issues.push({
          id: 'missing-eslint-config',
          type: 'info',
          category: 'Linting',
          file: 'eslint.config.js',
          message: 'Kein ESLint-Config gefunden. (Optional, aber hilfreich.)',
          fixable: false,
          priority: 'low',
        });
      }

      const pkg = files.find((f) => f.path === 'package.json');
      if (!pkg) {
        issues.push({
          id: 'missing-package-json',
          type: 'error',
          category: 'Projekt',
          file: 'package.json',
          message: 'package.json fehlt.',
          fixable: true,
          priority: 'high',
        });
      } else {
        try {
          const parsed = JSON.parse(pkg.content || '{}');
          const scripts = parsed?.scripts || {};
          if (!scripts.lint) {
            issues.push({
              id: 'missing-script-lint',
              type: 'info',
              category: 'Scripts',
              file: 'package.json',
              message: "Kein npm-script 'lint' gefunden.",
              fixable: false,
              priority: 'low',
            });
          }
          if (!scripts.typecheck && !scripts.tsc) {
            issues.push({
              id: 'missing-script-typecheck',
              type: 'info',
              category: 'Scripts',
              file: 'package.json',
              message: "Kein npm-script 'typecheck'/'tsc' gefunden.",
              fixable: false,
              priority: 'low',
            });
          }
          if (!scripts.test && !files.find((f) => f.path === 'jest.config.js')) {
            issues.push({
              id: 'missing-tests',
              type: 'info',
              category: 'Tests',
              file: 'jest.config.js',
              message: 'Kein Tests-Setup erkannt (jest.config.js oder script test).',
              fixable: false,
              priority: 'low',
            });
          }
        } catch {
          issues.push({
            id: 'invalid-package-json',
            type: 'error',
            category: 'Projekt',
            file: 'package.json',
            message: 'package.json ist kein gültiges JSON.',
            fixable: false,
            priority: 'high',
          });
        }
      }

      }

      // ✅ KRITISCHER FIX:
      // Fix nur anbieten, wenn Datei laut Allowlist wirklich “schreibbar/erlaubt” ist
      for (const issue of issues) {
        if (!issue.fixable || !issue.file) continue;
        const res = validateFilePath(issue.file);
        if (!res.valid) {
          issue.fixable = false;
          issue.message += '\n\n🔒 Auto-Fix deaktiviert: Datei ist außerhalb erlaubter Pfade/Policy.';
        }
      }

      setReport({ timestamp: new Date().toISOString(), issues });
    } catch (e: any) {
      Alert.alert('Diagnose fehlgeschlagen', e?.message || 'Unbekannter Fehler');
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectData]);

  const fixIssue = useCallback(
    (issue: DiagnosticIssue) => {
      const msg =
        `🔧 Fix Request: ${issue.category}\n\n` +
        (issue.file ? `File: ${issue.file}\n` : '') +
        `Issue: ${issue.message}\n\n` +
        `Bitte fixen und vollständige Datei ausgeben.`;

      triggerAutoFix(msg);
      Alert.alert('Fix gesendet', 'Fix-Anfrage wurde an den Chat gesendet.');
    },
    [triggerAutoFix],
  );

  const content = useMemo(() => {
    if (!report) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Noch keine Diagnose. Drück “Run”.</Text>
        </View>
      );
    }
    if (report.issues.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>✅ Keine Issues gefunden.</Text>
        </View>
      );
    }
    return report.issues.map((issue) => (
      <View key={issue.id} style={styles.issueCard}>
        <View style={styles.issueTop}>
          <Ionicons name="pulse" size={18} color={theme.palette.primary} />
          <Text style={styles.issueCat}>{issue.category}</Text>
          <View style={{ flex: 1 }} />
          {issue.fixable ? (
            <TouchableOpacity style={styles.fixBtn} onPress={() => fixIssue(issue)}>
              <Ionicons name="hammer" size={16} color={theme.palette.background} />
              <Text style={styles.fixBtnText}>Fix</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noFixPill}>
              <Text style={styles.noFixText}>Kein Fix</Text>
            </View>
          )}
        </View>

        {!!issue.file && <Text style={styles.file}>{issue.file}</Text>}
        <Text style={styles.msg}>{issue.message}</Text>
      </View>
    ));
  }, [report, fixIssue]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Diagnose</Text>
        <TouchableOpacity style={styles.runBtn} onPress={runDiagnostic} disabled={isAnalyzing}>
          {isAnalyzing ? <ActivityIndicator /> : <Text style={styles.runText}>Run</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll}>{content}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  header: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { color: theme.palette.text.primary, fontSize: 22, fontWeight: '800' },
  runBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  runText: { color: theme.palette.text.primary, fontWeight: '900' },
  scroll: { flex: 1, paddingHorizontal: 14 },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { color: theme.palette.text.secondary },

  issueCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  issueTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  issueCat: { color: theme.palette.text.primary, fontWeight: '900' },
  file: { marginTop: 6, color: theme.palette.primary, fontSize: 12 },
  msg: { marginTop: 6, color: theme.palette.text.primary, lineHeight: 18 },

  fixBtn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  fixBtnText: { color: theme.palette.background, fontWeight: '900' },

  noFixPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  noFixText: { color: theme.palette.text.secondary, fontWeight: '800' },
});
