import { canActorModifyPath } from './projectOwnership';
import { normalizePath } from './validators';

export type EffectiveWritePolicy = {
  writableRoots: string[];
  writablePrefixes: string[];
  guardedExamples: Array<{ path: string; reason: string }>;
};

const NORMAL_CHAT_WRITE_ROOT_PROBES = [
  'App.tsx',
  'App.js',
  'index.js',
  'config.ts',
  'theme.ts',
  'babel.config.js',
  'eslint.config.js',
  'jest.config.js',
  'jest.setup.js',
  'expo-env.d.ts',
  '.gitignore',
  '.npmrc',
  'README.md',
];

const NORMAL_CHAT_WRITE_PREFIX_PROBES: Record<string, string> = {
  '__mocks__/': '__mocks__/example.ts',
  '__tests__/': '__tests__/example.test.ts',
  'assets/': 'assets/example.png',
  'components/': 'components/Example.tsx',
  'contexts/': 'contexts/ExampleContext.tsx',
  'hooks/': 'hooks/useExample.ts',
  'lib/': 'lib/example.ts',
  'navigation/': 'navigation/Example.tsx',
  'screens/': 'screens/ExampleScreen.tsx',
  'services/': 'services/example.ts',
  'src/': 'src/example.ts',
  'styles/': 'styles/example.ts',
  'types/': 'types/example.ts',
  'utils/': 'utils/example.ts',
};

const GUARDED_CHAT_PATH_PROBES = [
  'package.json',
  'package-lock.json',
  'app.json',
  'app.config.js',
  'app.config.ts',
  'eas.json',
  'eas-project.json',
  'metro.config.js',
  'tsconfig.json',
  '.github/workflows/eas-build.yml',
  '.github/actions/example/action.yml',
  'supabase/functions/example/index.ts',
  'templates/example.json',
  'scripts/example.sh',
  'docs/patches/patch_999.md',
  'android/app/build.gradle',
  'ios/Podfile',
];

const uniqueSorted = (values: string[]): string[] => [...new Set(values.map((value) => normalizePath(value)).filter(Boolean))].sort();

const normalizePrefix = (prefix: string): string => `${normalizePath(prefix).replace(/\/+$/, '')}/`;

function describeGuardedReason(reason: string): string {
  if (/Template\/Baseline/i.test(reason)) return 'baseline-verwaltet/read-only';
  if (/kritisch/i.test(reason)) return 'kritisch/manual-only';
  return 'guarded';
}

export function getEffectiveChatWritePolicy(): EffectiveWritePolicy {
  const writableRoots = uniqueSorted(
    NORMAL_CHAT_WRITE_ROOT_PROBES.filter((candidate) => canActorModifyPath('chat', candidate).allowed),
  );

  const writablePrefixes = [...new Set(
    Object.entries(NORMAL_CHAT_WRITE_PREFIX_PROBES)
      .filter(([, probe]) => canActorModifyPath('chat', probe).allowed)
      .map(([prefix]) => normalizePrefix(prefix)),
  )].sort();

  const guardedExamples = uniqueSorted(GUARDED_CHAT_PATH_PROBES)
    .map((path) => {
      const decision = canActorModifyPath('chat', path);
      return decision.allowed
        ? null
        : {
            path: decision.normalizedPath,
            reason: decision.reason ?? 'Guarded path',
          };
    })
    .filter((entry): entry is { path: string; reason: string } => !!entry);

  return {
    writableRoots,
    writablePrefixes,
    guardedExamples,
  };
}

export function buildEffectiveChatWriteHint(): string {
  const policy = getEffectiveChatWritePolicy();
  const writableRoots = policy.writableRoots.slice(0, 10).join(', ');
  const writablePrefixes = policy.writablePrefixes.slice(0, 10).join(', ');
  const guardedExamples = policy.guardedExamples
    .map(({ path, reason }) => `${path} (${describeGuardedReason(reason)})`)
    .join(', ');

  const parts = [
    'Kontext-Hinweis: Du siehst nur einen priorisierten, gekürzten Projektausschnitt und keine Vollrepo-Sicht. Plane nur mit sichtbaren Dateien bzw. klar benannten Pfaden.',
    writablePrefixes ? `Realistische normale Schreibbereiche im Chat-Flow: ${writablePrefixes}.` : '',
    writableRoots ? `Normale Root-Dateien im Chat-Flow nur falls wirklich nötig: ${writableRoots}.` : '',
    guardedExamples
      ? `Guarded/manual-only statt normal beschreibbar: ${guardedExamples}. Solche Pfade nur als manuellen oder gesondert guardierten Folgeschritt erwähnen.`
      : '',
  ].filter(Boolean);

  return parts.join(' ');
}
