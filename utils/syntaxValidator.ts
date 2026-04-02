// utils/syntaxValidator.ts - Erweiterte Syntax-Validierung für Code-Editor
export type SyntaxError = {
  message: string;
  severity: 'error' | 'warning';
  line?: number;
  code?: string;
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePathSeparators = (value: string): string =>
  value.replace(/\\/g, '/');

const extractImportIdentifiers = (importClause: string): string[] => {
  const identifiers = new Set<string>();
  const clause = importClause.replace(/\s+/g, ' ').trim();
  if (!clause) return [];

  const cleanedClause = clause.replace(/^type\s+/, '').trim();

  const namespaceMatch = cleanedClause.match(/\*\s+as\s+([A-Za-z0-9_$]+)/i);
  if (namespaceMatch) {
    identifiers.add(namespaceMatch[1]);
  }

  const defaultMatch = cleanedClause.match(/^([A-Za-z0-9_$]+)/);
  if (
    defaultMatch &&
    !defaultMatch[0].startsWith('{') &&
    !defaultMatch[0].startsWith('*')
  ) {
    identifiers.add(defaultMatch[1]);
  }

  const braceMatch = cleanedClause.match(/\{([^}]*)\}/);
  if (braceMatch) {
    braceMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const sanitized = part.replace(/^type\s+/, '').trim();
        const aliasParts = sanitized.split(/\s+as\s+/i);
        const identifier = aliasParts.pop()?.trim();
        if (identifier) {
          identifiers.add(identifier);
        }
      });
  }

  return Array.from(identifiers);
};

type DelimiterSummary = {
  openBrackets: number;
  closeBrackets: number;
};

const summarizeDelimitersOutsideLiterals = (code: string): DelimiterSummary => {
  let openBrackets = 0;
  let closeBrackets = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inRegex = false;
  let escaped = false;
  const templateExpressionDepths: number[] = [];

  const isInTemplateText = (): boolean =>
    templateExpressionDepths.length > 0 && templateExpressionDepths[templateExpressionDepths.length - 1] === 0;

  const canStartRegex = (previous: string | null): boolean => {
    if (!previous) return true;
    return /[=(:,!&|?;{}\[\]]/.test(previous);
  };

  let previousSignificant: string | null = null;

  for (let index = 0; index < code.length; index += 1) {
    const current = code[index];
    const next = code[index + 1] ?? '';

    if (inLineComment) {
      if (current === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inSingleQuote || inDoubleQuote || isInTemplateText() || inRegex) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (current === '\\') {
        escaped = true;
        continue;
      }
      if (inSingleQuote && current === "'") {
        inSingleQuote = false;
        continue;
      }
      if (inDoubleQuote && current === '"') {
        inDoubleQuote = false;
        continue;
      }
      if (isInTemplateText()) {
        if (current === '`') {
          templateExpressionDepths.pop();
          continue;
        }
        if (current === '$' && next === '{') {
          templateExpressionDepths[templateExpressionDepths.length - 1] = 1;
          previousSignificant = '{';
          index += 1;
          continue;
        }
      }
      if (inRegex && current === '/') {
        inRegex = false;
        continue;
      }
      continue;
    }

    if (current === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (current === "'") {
      inSingleQuote = true;
      continue;
    }

    if (current === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (current === '`') {
      templateExpressionDepths.push(0);
      continue;
    }

    if (current === '/' && canStartRegex(previousSignificant)) {
      inRegex = true;
      continue;
    }

    if ('([{'.includes(current)) {
      openBrackets += 1;
      if (templateExpressionDepths.length > 0 && templateExpressionDepths[templateExpressionDepths.length - 1] > 0) {
        templateExpressionDepths[templateExpressionDepths.length - 1] += 1;
      }
    } else if (')]}'.includes(current)) {
      closeBrackets += 1;
      if (
        current === '}' &&
        templateExpressionDepths.length > 0 &&
        templateExpressionDepths[templateExpressionDepths.length - 1] > 0
      ) {
        templateExpressionDepths[templateExpressionDepths.length - 1] -= 1;
      }
    }

    if (!/\s/.test(current)) {
      previousSignificant = current;
    }
  }

  return { openBrackets, closeBrackets };
};

const stripImportLines = (code: string): string =>
  code.replace(/^\s*import\s+.*?\s+from\s+['"].*?['"];?\s*$/gm, '');

export const validateSyntax = (code: string, filePath: string): SyntaxError[] => {
  const errors: SyntaxError[] = [];
  const extension = filePath.match(/\.(jsx?|tsx?|json|md)$/i)?.[1]?.toLowerCase();
  const normalizedPath = normalizePathSeparators(filePath);

  if (!extension) return errors;

  // TypeScript/JavaScript validation
  if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
    // Check for unmatched brackets outside strings/comments/regex literals.
    const { openBrackets, closeBrackets } = summarizeDelimitersOutsideLiterals(code);
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
    if (
      normalizedPath.includes('/components/') ||
      normalizedPath.includes('/screens/')
    ) {
      if (!code.includes('export default') && !code.includes('export const') && !code.includes('export function')) {
        errors.push({
          message: 'Komponente hat keinen Export (export default/const/function fehlt)',
          severity: 'error',
        });
      }
    }

    // Check for unused imports (basic check, excluding import declarations themselves).
    const importMatches = code.match(/import\s+.*?\s+from\s+['"].*?['"]/g) || [];
    const codeWithoutImports = stripImportLines(code);
    importMatches.forEach((importLine) => {
      const clauseMatch = importLine.match(/^import\s+(.+?)\s+from\s+['"]/i);
      if (!clauseMatch) return;

      const identifiers = extractImportIdentifiers(clauseMatch[1]);
      identifiers.forEach((identifier) => {
        const usageRegex = new RegExp(`\\b${escapeRegex(identifier)}\\b`, 'g');
        const usageCount = (codeWithoutImports.match(usageRegex) || []).length;
        if (usageCount < 1) {
          errors.push({
            message: `Import "${identifier}" scheint ungenutzt zu sein`,
            severity: 'warning',
          });
        }
      });
    });
  }

  // JSON validation
  if (extension === 'json') {
    try {
      JSON.parse(code);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({
        message: `JSON Syntax-Fehler: ${msg}`,
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
