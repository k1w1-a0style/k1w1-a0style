// utils/metaCommands.ts - Meta-Commands für den Chat-Builder
import { ProjectFile, ChatMessage } from '../contexts/types';
import { v4 as uuidv4 } from 'uuid';
import { validateProjectFiles } from './chatUtils';

export type MetaCommandResult = {
  handled: boolean;
  message?: ChatMessage;
};

export const handleMetaCommand = (
  userContent: string,
  projectFiles: ProjectFile[]
): MetaCommandResult => {
  const lower = userContent.toLowerCase();

  // Command: Wie viele Dateien
  if (lower.includes('wie viele datei')) {
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
  if (lower.includes('liste alle datei')) {
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

    const lines = projectFiles.map((f) => `• ${f.path}`).join('\n');
    return {
      handled: true,
      message: {
        id: uuidv4(),
        role: 'assistant',
        content: `📂 Aktuelle Projektdateien (${projectFiles.length}):\n\n${lines}`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Command: Prüfe alle Dateien
  if (lower.includes('prüfe alle datei')) {
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
