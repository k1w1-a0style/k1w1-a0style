// screens/AppStatusScreen/hooks/appStatusHelpers.ts
// Extracted from useAppStatusScreen.ts: pure parsing/analysis functions.

import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import type { ProjectFile } from '../../../shared/types/project';
import { useProject } from '../../../contexts/ProjectContext';
import { normalizePath } from '../../../lib/validators';
import type {
  BuildConfig,
  DependencyItem,
  FileTree,
  ProjectStats,
  SectionType,
  ValidationIssue,
} from '../types';


export type PackageJson = {
  name?: string;
  version?: string;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type ExpoConfigJson = {
  name?: string;
  owner?: string;
  android?: {
    package?: string;
  };
};

export type ExpoConfigParseResult = {
  config: ExpoConfigJson | null;
  source: 'app.json' | 'app.config.js' | 'app.config.ts' | null;
  error?: string;
  hasCanonicalConflict?: boolean;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readStringField(record: JsonRecord | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNestedRecord(record: JsonRecord | null, key: string): JsonRecord | null {
  return asRecord(record?.[key]);
}

export function readText(file: ProjectFile | undefined): string {
  return String(file?.content ?? '');
}

export function safeJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: 'JSON Parse Error' };
  }
}

export function countLinesSafe(content: string, maxChars = 200_000): number {
  if (!content) return 0;
  const slice = content.length > maxChars ? content.slice(0, maxChars) : content;
  // Count '\n' without allocating split arrays.
  let lines = 1;
  for (let i = 0; i < slice.length; i++) {
    if (slice.charCodeAt(i) === 10) lines++;
  }
  // If truncated, signal approximation by adding a small constant (avoid lying too hard).
  if (slice.length !== content.length) lines += 1;
  return lines;
}

export function extractWithRegex(content: string): ExpoConfigJson {
  const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
  const ownerMatch = content.match(/owner:\s*["']([^"']+)["']/);

  // Supports both:
  //   android: { package: "..." }
  // and legacy/simpler:
  //   package: "..."
  const packageMatch = content.match(
    /android\s*:\s*\{[\s\S]*?package\s*:\s*["']([^"']+)["']|package\s*:\s*["']([^"']+)["']/
  );

  return {
    name: nameMatch?.[1],
    owner: ownerMatch?.[1],
    android: {
      package: packageMatch?.[1] || packageMatch?.[2],
    },
  };
}

export function parseExpoConfig(files: ProjectFile[]): ExpoConfigParseResult {
  const byNormalizedPath = new Map<string, ProjectFile>();
  const configPaths = new Set(["app.json", "app.config.ts", "app.config.js"]);

  for (const file of files) {
    const normalizedPath = normalizePath(String(file.path ?? ""));
    if (!normalizedPath) continue;
    if (!configPaths.has(normalizedPath)) {
      if (!byNormalizedPath.has(normalizedPath)) {
        byNormalizedPath.set(normalizedPath, file);
      }
      continue;
    }

    const existing = byNormalizedPath.get(normalizedPath);
    if (!existing) {
      byNormalizedPath.set(normalizedPath, file);
      continue;
    }

    if (readText(existing) !== readText(file)) {
      return {
        config: null,
        source: normalizedPath as ExpoConfigParseResult['source'],
        error: `Konflikt: Mehrere kanonische Varianten von ${normalizedPath} mit unterschiedlichem Inhalt gefunden`,
        hasCanonicalConflict: true,
      };
    }
  }

  // Priority: app.json (common & easy) -> app.config.ts -> app.config.js
  const appJson = byNormalizedPath.get('app.json');
  if (appJson) {
    const parsed = safeJsonParse<unknown>(readText(appJson));
    if (!parsed.ok) {
      return { config: null, source: 'app.json', error: parsed.error };
    }
    const root = asRecord(parsed.value);
    const expo = readNestedRecord(root, 'expo') ?? root;
    const android = readNestedRecord(expo, 'android');
    const config: ExpoConfigJson = {
      name: readStringField(expo, 'name'),
      owner: readStringField(expo, 'owner'),
      android: { package: readStringField(android, 'package') },
    };
    return { config, source: 'app.json' };
  }

  const appConfigTs = byNormalizedPath.get('app.config.ts');
  if (appConfigTs) {
    return { config: extractWithRegex(readText(appConfigTs)), source: 'app.config.ts' };
  }

  const appConfigJs = byNormalizedPath.get('app.config.js');
  if (appConfigJs) {
    return { config: extractWithRegex(readText(appConfigJs)), source: 'app.config.js' };
  }

  return { config: null, source: null };
}

export type EntryPointCheck = {
  entryLabel: string;
  ok: boolean;
  missingPath?: string;
};

export function resolveEntryPoint(files: ProjectFile[], pkg: PackageJson | null): EntryPointCheck {
  const pathSet = new Set(files.map((file) => normalizePath(String(file.path ?? ""))));
  const fileExists = (p: string) => pathSet.has(normalizePath(p));

  const main = (pkg?.main ?? 'index.js').trim();

  // expo-router uses "expo-router/entry" (module, not a project file).
  if (main === 'expo-router/entry') {
    const hasLayout = fileExists('app/_layout.tsx') || fileExists('app/_layout.js');
    const hasAppDir = files.some(f => f.path.startsWith('app/'));
    const ok = hasLayout || hasAppDir;
    return {
      entryLabel: 'expo-router/entry',
      ok,
      missingPath: ok ? undefined : 'app/_layout.tsx',
    };
  }

  // If main looks like a path, it should exist.
  if (main.includes('/') || main.endsWith('.js') || main.endsWith('.ts') || main.endsWith('.tsx')) {
    if (fileExists(main)) {
      return { entryLabel: main, ok: true };
    }
    // Some projects use index.ts.
    if (main === 'index.js' && fileExists('index.ts')) {
      return { entryLabel: 'index.ts', ok: true };
    }
    return { entryLabel: main, ok: false, missingPath: main };
  }

  // Unknown module: can't validate file existence.
  return { entryLabel: main, ok: true };
}

export function resolveFoundationValidationIssues(params: {
  isLoading: boolean;
  hasProjectData: boolean;
  isRecoveryMode?: boolean;
}): ValidationIssue[] {
  if (params.isLoading) {
    return [{
      type: 'info',
      message: 'Projektstatus wird initialisiert',
      details: 'Bootstrap/Hydration läuft, daher noch kein Ready-Status.',
    }];
  }
  if (params.isRecoveryMode) {
    return [{
      type: 'warning',
      message: 'Recovery-Modus aktiv',
      details: 'Persistenter Speicher ist blockiert; Status bleibt fail-closed.',
    }];
  }
  if (!params.hasProjectData) {
    return [{
      type: 'error',
      message: 'Keine Projektbasis geladen',
      details: 'Ohne materialisierte Projektdaten wird kein Ready-Status angezeigt.',
    }];
  }
  return [];
}

export const MAX_DEP_ITEMS = 250;
export const MAX_DIRS = 80;
export const MAX_FILES_PER_DIR = 250;

export type DerivedState = {
  buildConfig: BuildConfig | null;
  projectStats: ProjectStats | null;
  validationIssues: ValidationIssue[];
  dependencies: DependencyItem[];
  dependenciesTotal: number;
  fileTree: FileTree;
  fileDirsTotal: number;
  fileTreeCounts: Record<string, number>;
};
