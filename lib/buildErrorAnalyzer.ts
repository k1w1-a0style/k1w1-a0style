// lib/buildErrorAnalyzer.ts - Automatic build error analysis with AI-powered suggestions
import { LogEntry } from '../hooks/useGitHubActionsLogs';

export interface ErrorAnalysis {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
  relevantLogs: string[];
  documentation?: string;
}

export interface BuildError {
  step: string;
  message: string;
  type: string;
}

/**
 * Analyzes build errors and provides actionable suggestions
 */
export class BuildErrorAnalyzer {
  private static errorPatterns = [
    {
      pattern: /EXPO_TOKEN|expo.*token/i,
      category: 'Authentifizierung',
      severity: 'critical' as const,
      description: 'Expo Token fehlt oder ist ungültig',
      suggestion: 'Überprüfe ob EXPO_TOKEN als Secret in GitHub Actions konfiguriert ist. Generiere einen neuen Token auf expo.dev/accounts/[account]/settings/access-tokens',
      documentation: 'https://docs.expo.dev/eas-update/github-actions/',
    },
    {
      pattern: /npm.*install.*failed|dependencies.*not.*found/i,
      category: 'Dependencies',
      severity: 'high' as const,
      description: 'Fehler beim Installieren der Abhängigkeiten',
      suggestion: 'Führe "npm ci" lokal aus und überprüfe package.json und package-lock.json. Stelle sicher, dass alle Dependencies kompatibel sind.',
      documentation: 'https://docs.npmjs.com/cli/v8/commands/npm-ci',
    },
    {
      pattern: /gradle.*failed|android.*build.*failed/i,
      category: 'Android Build',
      severity: 'high' as const,
      description: 'Android Gradle Build fehlgeschlagen',
      suggestion: 'Überprüfe android/build.gradle und stelle sicher, dass alle Android Dependencies und SDK Versionen kompatibel sind. Prüfe auch die JDK Version.',
      documentation: 'https://docs.expo.dev/build-reference/android-builds/',
    },
    {
      pattern: /pod.*install.*failed|ios.*build.*failed/i,
      category: 'iOS Build',
      severity: 'high' as const,
      description: 'iOS CocoaPods oder Build fehlgeschlagen',
      suggestion: 'Führe "npx pod-install" lokal aus. Überprüfe ios/Podfile und stelle sicher, dass die iOS Deployment Target Version korrekt ist.',
      documentation: 'https://docs.expo.dev/build-reference/ios-builds/',
    },
    {
      pattern: /typescript.*error|type.*error|TS\d+/i,
      category: 'TypeScript',
      severity: 'medium' as const,
      description: 'TypeScript Typ-Fehler',
      suggestion: 'Führe "npm run lint" und "tsc --noEmit" lokal aus. Behebe alle TypeScript Fehler vor dem Build.',
      documentation: 'https://www.typescriptlang.org/docs/',
    },
    {
      pattern: /memory.*exceeded|out.*of.*memory|heap.*size/i,
      category: 'Ressourcen',
      severity: 'critical' as const,
      description: 'Build lief in Memory-Probleme',
      suggestion: 'Erhöhe die resourceClass in eas.json auf "large" oder optimiere die Bundle-Größe durch Code-Splitting und Tree-Shaking.',
      documentation: 'https://docs.expo.dev/build-reference/infrastructure/',
    },
    {
      pattern: /timeout|timed.*out/i,
      category: 'Timeout',
      severity: 'high' as const,
      description: 'Build Timeout überschritten',
      suggestion: 'Der Build dauert zu lange. Optimiere Build-Zeit durch Caching in eas.json oder verwende eine größere resourceClass.',
      documentation: 'https://docs.expo.dev/build-reference/caching/',
    },
    {
      pattern: /certificate|provisioning.*profile|signing/i,
      category: 'Code Signing',
      severity: 'critical' as const,
      description: 'iOS Code Signing Problem',
      suggestion: 'Überprüfe Certificates und Provisioning Profiles in deinem Apple Developer Account und in EAS.',
      documentation: 'https://docs.expo.dev/app-signing/app-credentials/',
    },
    {
      pattern: /module.*not.*found|cannot.*find.*module/i,
      category: 'Import Fehler',
      severity: 'high' as const,
      description: 'Module nicht gefunden',
      suggestion: 'Stelle sicher, dass alle importierten Module in package.json definiert sind. Führe "npm install" aus und committe node_modules nicht.',
      documentation: 'https://nodejs.org/api/modules.html',
    },
    {
      pattern: /network.*error|connection.*refused|ECONNREFUSED/i,
      category: 'Netzwerk',
      severity: 'medium' as const,
      description: 'Netzwerkfehler während des Builds',
      suggestion: 'Das ist meist ein temporäres Problem. Starte den Build erneut. Bei wiederholten Fehlern überprüfe die Netzwerk-Konfiguration.',
      documentation: 'https://docs.expo.dev/build-reference/troubleshooting/',
    },
    {
      pattern: /syntax.*error|unexpected.*token/i,
      category: 'Syntax Fehler',
      severity: 'high' as const,
      description: 'JavaScript/TypeScript Syntax Fehler',
      suggestion: 'Führe ESLint aus: "npm run lint". Überprüfe die Syntax in den angegebenen Dateien.',
      documentation: 'https://eslint.org/docs/latest/',
    },
  ];

  /**
   * Analyzes logs and extracts error information
   */
  static analyzeLogs(logs: LogEntry[]): ErrorAnalysis[] {
    const analyses: ErrorAnalysis[] = [];
    const errorLogs = logs.filter(log => log.level === 'error');

    if (errorLogs.length === 0) {
      return [];
    }

    // Check each error pattern
    for (const pattern of this.errorPatterns) {
      const matchingLogs = errorLogs.filter(log => 
        pattern.pattern.test(log.message)
      );

      if (matchingLogs.length > 0) {
        analyses.push({
          category: pattern.category,
          severity: pattern.severity,
          description: pattern.description,
          suggestion: pattern.suggestion,
          relevantLogs: matchingLogs.map(l => l.message).slice(0, 3),
          documentation: pattern.documentation,
        });
      }
    }

    // If no specific pattern matched, provide generic analysis
    if (analyses.length === 0 && errorLogs.length > 0) {
      analyses.push({
        category: 'Allgemeiner Fehler',
        severity: 'high',
        description: 'Build fehlgeschlagen',
        suggestion: 'Überprüfe die Logs unten für Details. Häufige Ursachen: Dependencies, TypeScript Fehler, oder Konfigurationsprobleme.',
        relevantLogs: errorLogs.map(l => l.message).slice(0, 3),
        documentation: 'https://docs.expo.dev/build-reference/troubleshooting/',
      });
    }

    return analyses;
  }

  /**
   * Extracts structured errors from logs
   */
  static extractErrors(logs: LogEntry[]): BuildError[] {
    const errors: BuildError[] = [];
    const errorLogs = logs.filter(log => log.level === 'error');

    for (const log of errorLogs) {
      errors.push({
        step: log.step || 'unknown',
        message: log.message,
        type: this.categorizeError(log.message),
      });
    }

    return errors;
  }

  /**
   * Categorizes an error message
   */
  private static categorizeError(message: string): string {
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(message)) {
        return pattern.category;
      }
    }
    return 'Unbekannt';
  }

  /**
   * Generates a summary of build issues
   */
  static generateSummary(analyses: ErrorAnalysis[]): string {
    if (analyses.length === 0) {
      return 'Keine spezifischen Fehler erkannt.';
    }

    const critical = analyses.filter(a => a.severity === 'critical').length;
    const high = analyses.filter(a => a.severity === 'high').length;
    const medium = analyses.filter(a => a.severity === 'medium').length;

    let summary = `${analyses.length} Problem(e) gefunden: `;
    const parts: string[] = [];
    
    if (critical > 0) parts.push(`${critical} kritisch`);
    if (high > 0) parts.push(`${high} hoch`);
    if (medium > 0) parts.push(`${medium} mittel`);

    return summary + parts.join(', ');
  }

  /**
   * Gets the most critical error
   */
  static getMostCriticalError(analyses: ErrorAnalysis[]): ErrorAnalysis | null {
    if (analyses.length === 0) return null;

    const severityOrder = ['critical', 'high', 'medium', 'low'];
    
    return analyses.sort((a, b) => {
      return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
    })[0];
  }
}
