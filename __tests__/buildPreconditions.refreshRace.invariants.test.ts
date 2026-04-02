import fs from 'fs';
import path from 'path';

describe('useBuildPreconditions refresh race hardening', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts'),
    'utf8',
  );

  it('guards async refresh writes with a refresh epoch', () => {
    expect(source).toContain('const refreshEpochRef = useRef(0);');
    expect(source).toContain('const refreshEpoch = ++refreshEpochRef.current;');
    expect(source).toContain('const applyIfCurrent = (apply: () => void) => {');
    expect(source).toContain('refreshEpochRef.current === refreshEpoch');
  });

  it('applies token, signing and readiness updates only through the guarded writer', () => {
    expect(source).toContain('applyIfCurrent(() => setHasTokens(!!(gh && expo)));');
    expect(source).toContain('applyIfCurrent(() => {\n        setHasSigningKey(signingGate.hasSigningKey);');
    expect(source).toContain('applyIfCurrent(() => {\n        setHasDiagOk(readiness.hasDiagOk);');
  });
});
