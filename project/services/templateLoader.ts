// project/services/templateLoader.ts
// Extracted from contexts/ProjectContext.tsx to keep ProjectContext slimmer.
// No behavioral changes intended.

import type { CoreTemplateId, ProjectFile, TemplateId } from '../../shared/types/project';
import { runTemplateHardChecklist } from '../../lib/diagnostics/templates';
import { logger } from '../../lib/logger';

type TemplateCatalogEntry = {
  id: CoreTemplateId;
  label: string;
  description: string;
  files: readonly unknown[];
};

const TEMPLATE_JSON_BY_ID: Record<CoreTemplateId, readonly unknown[]> = {
  base: require('../../templates/expo-sdk54-base.json') as readonly unknown[],
  navigation: require('../../templates/expo-sdk54-navigation.json') as readonly unknown[],
  crud: require('../../templates/expo-sdk54-crud.json') as readonly unknown[],
  full: require('../../templates/expo-sdk54-full.json') as readonly unknown[],
};

function resolveCoreTemplateId(templateId: TemplateId): CoreTemplateId {
  return templateId === 'auto' ? 'base' : templateId;
}

function isTemplateFileRecord(value: unknown): value is { path: string; content?: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.path === 'string';
}

function normalizeTemplateFile(value: unknown): ProjectFile {
  if (!isTemplateFileRecord(value)) {
    throw new Error('Template-Datei ist ungültig');
  }
  return {
    path: value.path,
    content:
      typeof value.content === 'string'
        ? value.content
        : JSON.stringify(value.content ?? '', null, 2),
  };
}

function loadTemplateJson(templateId: TemplateId): readonly unknown[] {
  const effectiveTemplateId = resolveCoreTemplateId(templateId);
  const template = TEMPLATE_JSON_BY_ID[effectiveTemplateId];
  if (!Array.isArray(template) || template.length === 0) {
    throw new Error('Template ist ungültig');
  }
  return template;
}

export const loadTemplateFromFile = async (templateId: TemplateId = 'base'): Promise<ProjectFile[]> => {
  try {
    const template = loadTemplateJson(templateId);
    const mapped = template.map(normalizeTemplateFile);

    // ✅ Harte Template-Checkliste (Autofix aktiv): verhindert "halbkaputte" New-Projects
    const firstPass = runTemplateHardChecklist(mapped, { autofix: true });
    const secondPass = runTemplateHardChecklist(firstPass.files, { autofix: false });

    if (!secondPass.report.ok) {
      const issues = secondPass.report.issues
        .map((i) => `- [${i.severity}] ${i.file ?? '(global)'}: ${i.reason}${i.fix ? ` → FIX: ${i.fix}` : ''}`)
        .join('\n');

      // Wir lassen das Projekt trotzdem entstehen (autofix hat schon viel repariert),
      // aber legen einen Report ab, damit du sofort siehst, was noch fehlt.
      const reportFile: ProjectFile = {
        path: 'TEMPLATE_CHECKLIST_REPORT.md',
        content: `# Template Checklist Report\n\n${secondPass.report.summary}\n\n${issues}\n`,
      };

      return [reportFile, ...firstPass.files];
    }

    return firstPass.files;
  } catch (error) {
    logger.error('Template Fehler', { err: error });
    return [{ path: 'README.md', content: '# Template Fehler' }];
  }
};

export const TEMPLATE_CATALOG: Record<CoreTemplateId, TemplateCatalogEntry> = {
  base: {
    id: 'base',
    label: 'Base (Blank)',
    description: 'Expo SDK 54 blank scaffold (Android-only) with EAS profiles (dev/preview/prod).',
    files: TEMPLATE_JSON_BY_ID.base,
  },
  navigation: {
    id: 'navigation',
    label: 'Navigation',
    description: 'Blank + React Navigation stack + basic screens (Android-only).',
    files: TEMPLATE_JSON_BY_ID.navigation,
  },
  crud: {
    id: 'crud',
    label: 'CRUD',
    description: 'Blank + simple CRUD sample + storage (Android-only).',
    files: TEMPLATE_JSON_BY_ID.crud,
  },
  full: {
    id: 'full',
    label: 'Full',
    description: 'Blank + React Navigation + CRUD sample (Android-only).',
    files: TEMPLATE_JSON_BY_ID.full,
  },
};
