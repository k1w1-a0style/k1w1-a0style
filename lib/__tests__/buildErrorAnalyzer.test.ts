// lib/__tests__/buildErrorAnalyzer.test.ts
import { BuildErrorAnalyzer, ErrorAnalysis, BuildError } from '../buildErrorAnalyzer';
import { LogEntry } from '../../hooks/useGitHubActionsLogs';

describe('BuildErrorAnalyzer', () => {
  describe('analyzeLogs', () => {
    it('should return empty array for empty logs', () => {
      const result = BuildErrorAnalyzer.analyzeLogs([]);
      expect(result).toEqual([]);
    });

    it('should return empty array when no error logs present', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'Build started', level: 'info' },
        { timestamp: '2025-01-01T00:01:00Z', message: 'Build completed', level: 'info' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      expect(result).toEqual([]);
    });

    it('should detect EXPO_TOKEN authentication errors', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'EXPO_TOKEN is not set', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Authentifizierung');
      expect(result[0].severity).toBe('critical');
      expect(result[0].relevantLogs).toContain('EXPO_TOKEN is not set');
    });

    it('should detect npm install failures', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'npm install failed with exit code 1', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Dependencies');
      expect(result[0].severity).toBe('high');
    });

    it('should detect Android Gradle build failures', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'Gradle build failed', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Android Build');
      expect(result[0].severity).toBe('high');
    });

    it('should detect iOS build failures', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'pod install failed', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('iOS Build');
      expect(result[0].severity).toBe('high');
    });

    it('should detect TypeScript errors', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'TS2345: Argument of type string is not assignable', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('TypeScript');
      expect(result[0].severity).toBe('medium');
    });

    it('should detect memory issues', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'JavaScript heap out of memory', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Ressourcen');
      expect(result[0].severity).toBe('critical');
    });

    it('should detect timeout errors', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'Build timed out after 30 minutes', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Timeout');
      expect(result[0].severity).toBe('high');
    });

    it('should detect code signing issues', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'No valid provisioning profile found', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Code Signing');
      expect(result[0].severity).toBe('critical');
    });

    it('should detect module not found errors', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: "Cannot find module 'react-native-maps'", level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Import Fehler');
      expect(result[0].severity).toBe('high');
    });

    it('should detect network errors', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'ECONNREFUSED 127.0.0.1:443', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Netzwerk');
      expect(result[0].severity).toBe('medium');
    });

    it('should detect syntax errors', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'SyntaxError: Unexpected token', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Syntax Fehler');
      expect(result[0].severity).toBe('high');
    });

    it('should provide generic analysis for unknown errors', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'Some unknown error occurred', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Allgemeiner Fehler');
      expect(result[0].severity).toBe('high');
    });

    it('should limit relevant logs to 3 entries', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'EXPO_TOKEN error 1', level: 'error' },
        { timestamp: '2025-01-01T00:01:00Z', message: 'EXPO_TOKEN error 2', level: 'error' },
        { timestamp: '2025-01-01T00:02:00Z', message: 'EXPO_TOKEN error 3', level: 'error' },
        { timestamp: '2025-01-01T00:03:00Z', message: 'EXPO_TOKEN error 4', level: 'error' },
        { timestamp: '2025-01-01T00:04:00Z', message: 'EXPO_TOKEN error 5', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result).toHaveLength(1);
      expect(result[0].relevantLogs).toHaveLength(3);
    });

    it('should detect multiple error categories', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'EXPO_TOKEN is not set', level: 'error' },
        { timestamp: '2025-01-01T00:01:00Z', message: 'TS2345: Type error', level: 'error' },
        { timestamp: '2025-01-01T00:02:00Z', message: 'npm install failed', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.analyzeLogs(logs);
      
      expect(result.length).toBeGreaterThanOrEqual(3);
      const categories = result.map(r => r.category);
      expect(categories).toContain('Authentifizierung');
      expect(categories).toContain('TypeScript');
      expect(categories).toContain('Dependencies');
    });
  });

  describe('extractErrors', () => {
    it('should return empty array for empty logs', () => {
      const result = BuildErrorAnalyzer.extractErrors([]);
      expect(result).toEqual([]);
    });

    it('should extract errors with step information', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'Build started', level: 'info' },
        { timestamp: '2025-01-01T00:01:00Z', message: 'EXPO_TOKEN missing', level: 'error', step: 'setup' },
        { timestamp: '2025-01-01T00:02:00Z', message: 'npm install failed', level: 'error', step: 'install' },
      ];
      const result = BuildErrorAnalyzer.extractErrors(logs);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        step: 'setup',
        message: 'EXPO_TOKEN missing',
        type: 'Authentifizierung',
      });
      expect(result[1]).toEqual({
        step: 'install',
        message: 'npm install failed',
        type: 'Dependencies',
      });
    });

    it('should use "unknown" step when not provided', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'Some error', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.extractErrors(logs);
      
      expect(result[0].step).toBe('unknown');
    });

    it('should categorize unknown errors as "Unbekannt"', () => {
      const logs: LogEntry[] = [
        { timestamp: '2025-01-01T00:00:00Z', message: 'Random unknown error', level: 'error' },
      ];
      const result = BuildErrorAnalyzer.extractErrors(logs);
      
      expect(result[0].type).toBe('Unbekannt');
    });
  });

  describe('generateSummary', () => {
    it('should return default message for empty analyses', () => {
      const result = BuildErrorAnalyzer.generateSummary([]);
      expect(result).toBe('Keine spezifischen Fehler erkannt.');
    });

    it('should generate summary with critical errors', () => {
      const analyses: ErrorAnalysis[] = [
        {
          category: 'Authentifizierung',
          severity: 'critical',
          description: 'Token fehlt',
          suggestion: 'Token hinzufügen',
          relevantLogs: ['log1'],
        },
      ];
      const result = BuildErrorAnalyzer.generateSummary(analyses);
      
      expect(result).toContain('1 Problem(e) gefunden');
      expect(result).toContain('1 kritisch');
    });

    it('should generate summary with mixed severities', () => {
      const analyses: ErrorAnalysis[] = [
        { category: 'A', severity: 'critical', description: '', suggestion: '', relevantLogs: [] },
        { category: 'B', severity: 'critical', description: '', suggestion: '', relevantLogs: [] },
        { category: 'C', severity: 'high', description: '', suggestion: '', relevantLogs: [] },
        { category: 'D', severity: 'medium', description: '', suggestion: '', relevantLogs: [] },
        { category: 'E', severity: 'low', description: '', suggestion: '', relevantLogs: [] },
      ];
      const result = BuildErrorAnalyzer.generateSummary(analyses);
      
      expect(result).toContain('5 Problem(e) gefunden');
      expect(result).toContain('2 kritisch');
      expect(result).toContain('1 hoch');
      expect(result).toContain('1 mittel');
      // low is not included in summary
    });
  });

  describe('getMostCriticalError', () => {
    it('should return null for empty analyses', () => {
      const result = BuildErrorAnalyzer.getMostCriticalError([]);
      expect(result).toBeNull();
    });

    it('should return the most critical error', () => {
      const analyses: ErrorAnalysis[] = [
        { category: 'TypeScript', severity: 'medium', description: 'TS Error', suggestion: '', relevantLogs: [] },
        { category: 'Auth', severity: 'critical', description: 'Token', suggestion: '', relevantLogs: [] },
        { category: 'Deps', severity: 'high', description: 'NPM', suggestion: '', relevantLogs: [] },
      ];
      const result = BuildErrorAnalyzer.getMostCriticalError(analyses);
      
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.category).toBe('Auth');
    });

    it('should return first error when all have same severity', () => {
      const analyses: ErrorAnalysis[] = [
        { category: 'A', severity: 'high', description: 'First', suggestion: '', relevantLogs: [] },
        { category: 'B', severity: 'high', description: 'Second', suggestion: '', relevantLogs: [] },
      ];
      const result = BuildErrorAnalyzer.getMostCriticalError(analyses);
      
      expect(result).not.toBeNull();
      expect(result!.category).toBe('A');
    });
  });
});
