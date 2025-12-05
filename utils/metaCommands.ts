// utils/metaCommands.ts - Meta-Commands für den Chat-Builder
import { ProjectFile, ChatMessage } from '../contexts/types';
import { v4 as uuidv4 } from 'uuid';
import { validateProjectFiles, normalizePath } from './chatUtils';

export type MetaCommandResult = {
  handled: boolean;
  message?: ChatMessage;
};

const MAX_LISTED_FILES = 50;

const normalizeCommandInput = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  const unquoted = trimmed.replace(/^['"`]+|['"`]+$/g, '');
  return unquoted.replace(/^(?:bitte\s+)?(?:kannst du\s+)?(?:bitte\s+)?/, '').trim();
};

const sanitizePathForDisplay = (path: string): string => {
  const normalized = normalizePath(path);
  return normalized || '(unbekannter Pfad)';
};

const formatFileList = (files: ProjectFile[]): string => {
  const limited = files.slice(0, MAX_LISTED_FILES);
  const lines = limited.map((f) => `• ${sanitizePathForDisplay(f.path)}`).join('\n');
  const remaining = files.length - limited.length;
  return `${lines}${remaining > 0 ? `\n… und ${remaining} weitere Datei(en).` : ''}`;
};

export const handleMetaCommand = (
  userContent: string,
  projectFiles: ProjectFile[]
): MetaCommandResult => {
  const normalizedInput = normalizeCommandInput(userContent);

  // Command: Wie viele Dateien
  if (/^(?:wie\s+viele|wieviele)\s+datei(?:en)?/.test(normalizedInput)) {
    const count = projectFiles.length;
    return {
      handled: true,
      message: {
        id: uuidv4(),
        role: 'assistant',
        content: `📊 Aktuell sind ${count} Datei(en) im Projekt gespeichert.`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Command: Liste alle Dateien
  if (/^liste\s+alle\s+datei(?:en)?/.test(normalizedInput)) {
    if (projectFiles.length === 0) {
      return {
        handled: true,
        message: {
          id: uuidv4(),
          role: 'assistant',
          content: '📂 Es sind noch keine Projektdateien vorhanden.',
          timestamp: new Date().toISOString(),
        },
      };
    }

    const list = formatFileList(projectFiles);
    return {
      handled: true,
      message: {
        id: uuidv4(),
        role: 'assistant',
        content: `📂 Aktuelle Projektdateien (${projectFiles.length}):\n\n${list}`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Command: Prüfe alle Dateien
  if (/^prüfe\s+alle\s+datei(?:en)?/.test(normalizedInput)) {
    if (projectFiles.length === 0) {
      return {
        handled: true,
        message: {
          id: uuidv4(),
          role: 'assistant',
          content: '⚠️ Es gibt keine Dateien zum Prüfen.',
          timestamp: new Date().toISOString(),
        },
      };
    }

    const validation = validateProjectFiles(projectFiles);
    if (validation.valid) {
      return {
        handled: true,
        message: {
          id: uuidv4(),
          role: 'assistant',
          content: `✅ Projektprüfung: Keine kritischen Probleme (${projectFiles.length} Dateien).`,
          timestamp: new Date().toISOString(),
        },
      };
    }

    const shown = validation.errors.slice(0, 15);
    const rest = validation.errors.length - shown.length;
    const errorText =
      shown.map((e) => `• ${e}`).join('\n') +
      (rest > 0 ? `\n… und ${rest} weitere Meldung(en).` : '');

    return {
      handled: true,
      message: {
        id: uuidv4(),
        role: 'assistant',
        content: `⚠️ Projektprüfung: ${validation.errors.length} Problem(e):\n\n${errorText}`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return { handled: false };
};
