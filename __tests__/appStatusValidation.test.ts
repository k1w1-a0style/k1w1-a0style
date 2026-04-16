
import {
  parseExpoConfig,
  resolveEntryPoint,
} from '../screens/AppStatusScreen/hooks/useAppStatusScreen';
import { resolveFoundationValidationIssues } from '../screens/AppStatusScreen/hooks/appStatusHelpers';

import type { ProjectFile } from "../shared/types/project";
describe('AppStatusScreen validation helpers', () => {
  const f = (path: string, content: string): ProjectFile => ({ path, content });

  test('parseExpoConfig prefers app.json and extracts android package', () => {
    const files: ProjectFile[] = [
      f('app.json', JSON.stringify({ expo: { name: 'X', android: { package: 'com.example.x' }, owner: 'me' } })),
      f('app.config.ts', `export default { name: 'Y', android: { package: 'com.example.y' } }`),
    ];

    const parsed = parseExpoConfig(files);
    expect(parsed.source).toBe('app.json');
    expect(parsed.config?.name).toBe('X');
    expect(parsed.config?.android?.package).toBe('com.example.x');
    expect(parsed.config?.owner).toBe('me');
  });


  test('parseExpoConfig tolerates non-object app.json payloads without crashing', () => {
    const files: ProjectFile[] = [f('app.json', JSON.stringify(['not-an-object']))];

    const parsed = parseExpoConfig(files);
    expect(parsed.source).toBe('app.json');
    expect(parsed.error).toBeUndefined();
    expect(parsed.config?.name).toBeUndefined();
    expect(parsed.config?.android?.package).toBeUndefined();
  });

  test('resolveEntryPoint accepts expo-router module entry if /app exists', () => {
    const files: ProjectFile[] = [f('app/_layout.tsx', 'export default function Layout() { return null; }')];
    const pkg = { main: 'expo-router/entry' };

    const res = resolveEntryPoint(files, pkg);
    expect(res.ok).toBe(true);
  });

  test('resolveEntryPoint fails when main points to missing file', () => {
    const files: ProjectFile[] = [f('index.js', 'console.log("hi")')];
    const pkg = { main: 'missing.js' };

    const res = resolveEntryPoint(files, pkg);
    expect(res.ok).toBe(false);
    expect(res.missingPath).toBe('missing.js');
  });

  test('path normalization collapses expo config path variants', () => {
    const files: ProjectFile[] = [
      f('./app.json', JSON.stringify({ expo: { name: 'X' } })),
    ];

    const parsed = parseExpoConfig(files);
    expect(parsed.source).toBe('app.json');
    expect(parsed.config?.name).toBe('X');
  });

  test('foundation issues stay fail-closed while loading and without project base', () => {
    expect(resolveFoundationValidationIssues({
      isLoading: true,
      hasProjectData: false,
      isRecoveryMode: false,
    })[0]?.message).toMatch(/initialisiert/i);

    expect(resolveFoundationValidationIssues({
      isLoading: false,
      hasProjectData: false,
      isRecoveryMode: false,
    })[0]?.type).toBe('error');
  });
});
