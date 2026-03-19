import { CONFIG } from '../config';
import { canActorModifyPath } from './projectOwnership';
import { normalizePath } from './validators';

export type EffectiveWritePolicy = {
  writableRoots: string[];
  writablePrefixes: string[];
  blockedExamples: string[];
};

const CHAT_PREFIX_PROBES: Record<string, string> = {
  '.github/': '.github/workflows/example.yml',
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
  'supabase/': 'supabase/functions/example/index.ts',
  'templates/': 'templates/example.json',
  'types/': 'types/example.ts',
  'utils/': 'utils/example.ts',
  'scripts/': 'scripts/example.sh',
};

const BLOCKED_PATH_EXAMPLES = [
  'package.json',
  'app.config.js',
  'app.json',
  'eas.json',
  'metro.config.js',
  'tsconfig.json',
  '.github/workflows/eas-build.yml',
  'supabase/functions/example/index.ts',
  'templates/example.json',
  'docs/patches/patch_999.md',
  'scripts/example.sh',
  'android/app/build.gradle',
  'ios/Podfile',
];

const uniqueSorted = (values: string[]): string[] => [...new Set(values.map((value) => normalizePath(value)).filter(Boolean))].sort();

const normalizePrefix = (prefix: string): string => `${normalizePath(prefix).replace(/\/+$/, '')}/`;

export function getEffectiveChatWritePolicy(): EffectiveWritePolicy {
  const roots = uniqueSorted([...(CONFIG.PATHS.ALLOWED_ROOT ?? []), ...(CONFIG.PATHS.ALLOWED_SINGLE ?? [])]);
  const prefixes = [...new Set((CONFIG.PATHS.ALLOWED_PREFIXES ?? []).map(normalizePrefix).filter(Boolean))].sort();

  const writableRoots = roots.filter((path) => canActorModifyPath('chat', path).allowed);
  const writablePrefixes = prefixes.filter((prefix) => {
    const probe = CHAT_PREFIX_PROBES[prefix] ?? `${prefix.replace(/\/+$/, '')}/example.ts`;
    return canActorModifyPath('chat', probe).allowed;
  });
  const blockedExamples = uniqueSorted(
    BLOCKED_PATH_EXAMPLES.filter((path) => !canActorModifyPath('chat', path).allowed),
  );

  return {
    writableRoots,
    writablePrefixes,
    blockedExamples,
  };
}

export function buildEffectiveChatWriteHint(): string {
  const policy = getEffectiveChatWritePolicy();
  const writableRoots = policy.writableRoots.slice(0, 10).join(', ');
  const writablePrefixes = policy.writablePrefixes.slice(0, 10).join(', ');
  const blockedExamples = policy.blockedExamples.join(', ');

  const parts = [
    writablePrefixes ? `Normale Schreibbereiche im Chat-Flow: ${writablePrefixes}.` : '',
    writableRoots ? `Einzeldateien im Root nur wenn explizit nötig und innerhalb der Chat-Policy: ${writableRoots}.` : '',
    blockedExamples
      ? `Nicht als normal beschreibbar darstellen: ${blockedExamples}. Solche Pfade sind im Chat-Flow read-only oder manuell.`
      : '',
  ].filter(Boolean);

  return parts.join(' ');
}
