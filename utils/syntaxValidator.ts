// utils/syntaxValidator.ts - Erweiterte Syntax-Validierung für Code-Editor
export type SyntaxError = {
  message: string;
  severity: 'error' | 'warning';
  line?: number;
};

export const validateSyntax = (code: string, filePath: string): SyntaxError[] => {
  const errors: SyntaxError[] = [];
  const extension = filePath.match(/\.(jsx?|tsx?|json|md)$/i)?.[1]?.toLowerCase();

  if (!extension) return errors;

  // TypeScript/JavaScript validation
  if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
    // Check for unmatched brackets
    const openBrackets = (code.match(/[\[{(]/g) || []).length;
    const closeBrackets = (code.match(/[\]})]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push({
        message: `Ungleiche Anzahl von Klammern: ${openBrackets} geöffnet, ${closeBrackets} geschlossen`,
        severity: 'error',
      });
    }

    // Check for unclosed strings (simple check)
    const lines = code.split('\n');
    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
      
      const quotes = line.match(/["'`]/g) || [];
      if (quotes.length % 2 !== 0) {
        errors.push({
          message: 'Möglicherweise ungeschlossene Anführungszeichen',
          severity: 'warning',
          line: index + 1,
        });
      }
    });

    // Check for common issues
    if (code.includes('console.log') && ['tsx', 'jsx'].includes(extension)) {
      errors.push({
        message: 'console.log() in Komponente gefunden - sollte im Production-Build entfernt werden',
        severity: 'warning',
      });
    }

    // Check for any type
    if (code.match(/:\s*any\b/) && ['ts', 'tsx'].includes(extension)) {
      errors.push({
        message: 'Type "any" verwendet - sollte spezifischer typisiert werden',
        severity: 'warning',
      });
    }

    // Check for missing exports in component files
    if (filePath.includes('/components/') || filePath.includes('/screens/')) {
      if (!code.includes('export default') && !code.includes('export const') && !code.includes('export function')) {
        errors.push({
          message: 'Komponente hat keinen Export (export default/const/function fehlt)',
          severity: 'error',
        });
      }
    }

    // Check for unused imports (basic check)
    const importMatches = code.match(/import\s+.*?\s+from\s+['"].*?['"]/g) || [];
    importMatches.forEach((importLine) => {
      const match = importLine.match(/import\s+\{?\s*([^}]+?)\s*\}?\s+from/);
      if (match) {
        const imported = match[1].trim();
        // Simple check if imported item is used
        const usageRegex = new RegExp(`\\b${imported}\\b`, 'g');
        const usageCount = (code.match(usageRegex) || []).length;
        if (usageCount === 1) { // Only found in import statement
          errors.push({
            message: `Import "${imported}" scheint ungenutzt zu sein`,
            severity: 'warning',
          });
        }
      }
    });
  }

  // JSON validation
  if (extension === 'json') {
    try {
      JSON.parse(code);
    } catch (e: any) {
      errors.push({
        message: `JSON Syntax-Fehler: ${e.message}`,
        severity: 'error',
      });
    }
  }

  return errors;
};

export const validateCodeQuality = (code: string, filePath: string): SyntaxError[] => {
  const errors: SyntaxError[] = [];
  const lines = code.split('\n');

  // Check for very long lines
  lines.forEach((line, index) => {
    if (line.length > 120) {
      errors.push({
        message: `Zeile ${index + 1} ist sehr lang (${line.length} Zeichen) - sollte < 120 sein`,
        severity: 'warning',
        line: index + 1,
      });
    }
  });

  // Check for deeply nested code
  lines.forEach((line, index) => {
    const indentation = line.search(/\S/);
    if (indentation > 24) { // More than 6 levels (4 spaces each)
      errors.push({
        message: `Zeile ${index + 1} ist stark verschachtelt - sollte refaktoriert werden`,
        severity: 'warning',
        line: index + 1,
      });
    }
  });

  // Check for TODO/FIXME comments
  const todoMatches = code.match(/\/\/\s*(TODO|FIXME|XXX|HACK):.*/gi) || [];
  if (todoMatches.length > 0) {
    errors.push({
      message: `${todoMatches.length} TODO/FIXME Kommentar(e) gefunden`,
      severity: 'warning',
    });
  }

  return errors;
};
