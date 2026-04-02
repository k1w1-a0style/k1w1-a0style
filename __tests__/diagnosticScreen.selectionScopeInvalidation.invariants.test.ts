import fs from 'fs';
import path from 'path';

describe('DiagnosticScreen selection scope invalidation', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts'),
    'utf8',
  );

  it('treats the first observed scope only as initialization and invalidates every later scope change', () => {
    expect(source).toContain('const didInitSelectionScopeRef = useRef(false);');
    expect(source).toContain('if (!didInitSelectionScopeRef.current) {');
    expect(source).toContain('didInitSelectionScopeRef.current = true;');
    expect(source).toContain('if (previousScope === nextScope) {');
  });

  it('still clears stale diagnostic UI state when the scope changes', () => {
    expect(source).toContain('setResults([]);');
    expect(source).toContain('setLastRunAt(null);');
    expect(source).toContain('setIssueSheetVisible(false);');
    expect(source).toContain('setPreviewEntries([]);');
  });
});
