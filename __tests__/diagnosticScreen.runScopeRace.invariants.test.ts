import fs from 'fs';
import path from 'path';

describe('DiagnosticScreen run scope race hardening', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'screens/DiagnosticScreen/hooks/useDiagnosticRunController.ts'),
    'utf8',
  );

  it('invalidates old async runs when the selection scope changes', () => {
    expect(source).toContain('const diagnosticRunEpochRef = useRef(0);');
    expect(source).toContain('const activeSelectionScopeRef = useRef<string | null>(null);');
    expect(source).toContain('const runEpoch = ++diagnosticRunEpochRef.current;');
    expect(source).toContain('const isCurrentRun = () =>');
    expect(source).toContain('activeSelectionScopeRef.current === runScope');
    expect(source).toContain('diagnosticRunEpochRef.current += 1;');
  });

  it('routes progressive updates through guarded callbacks instead of raw setters', () => {
    expect(source).toContain('setResults: guardedSetResults');
    expect(source).toContain('setProgressStage: guardedSetProgressStage');
    expect(source).toContain('if (diagnosticRunEpochRef.current === runEpoch) {');
  });

  it('invalidates persisted readiness to false before checks and again on run failures', () => {
    expect(source).toContain('const runFilesSnapshot = (projectRef.current.files ?? []).map((file) => ({');
    expect(source).toContain('const runProjectFingerprint = computeDiagnosticProjectFingerprint(runFilesSnapshot);');
    expect(source).toContain('await persistScopedReadiness({');
    expect(source).toContain('diagnosticOk: false,');
    expect(source).toContain('runProjectFingerprint,');
    expect(source).toContain('Alert.alert("Diagnostics fehlgeschlagen", getDiagnosticUiErrorMessage(e));');
  });
});
