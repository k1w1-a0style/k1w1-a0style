// lib/promptEngine.ts
// Zentrale Prompt-Logik für den k1w1 APK-Builder

import { ProjectFile } from '../contexts/types';
import { CONFIG } from '../config';

export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

// Hilfsfunktion: kleine, komprimierte Projektübersicht für den Prompt
function buildProjectSnapshot(files: ProjectFile[]): string {
  if (!files || files.length === 0) {
    return 'Es sind aktuell noch keine Projektdateien angelegt.';
  }

  const MAX_FILES = 20;
  const MAX_LINES_PER_FILE = 40;

  const limitedFiles = [...files].slice(0, MAX_FILES).map((f) => {
    const path = f.path;
    const content = String(f.content ?? '');
    const lines = content.split('\n').slice(0, MAX_LINES_PER_FILE);
    return `# ${path}\n${lines.join('\n')}`;
  });

  return (
    'Ausschnitt der aktuellen Projektdateien (gekürzt):\n\n' +
    limitedFiles.join('\n\n') +
    '\n\n(Hinweis: Dies ist nur ein Ausschnitt, nicht das komplette Projekt.)'
  );
}

function buildAllowedPathHint(): string {
  try {
    const roots = CONFIG?.PATHS?.ALLOWED_ROOT ?? [];
    const singles = CONFIG?.PATHS?.ALLOWED_SINGLE ?? [];
    const prefixes = CONFIG?.PATHS?.ALLOWED_PREFIXES ?? [];

    const rootList = roots.length ? `ALLOWED_ROOT: ${roots.join(', ')}` : '';
    const singleList = singles.length ? `ALLOWED_SINGLE: ${singles.join(', ')}` : '';
    const prefixList = prefixes.length ? `ALLOWED_PREFIXES: ${prefixes.join(', ')}` : '';

    const parts = [rootList, singleList, prefixList].filter(Boolean);
    if (!parts.length) return '';

    return (
      'Erlaubte Pfade (Validator): ' +
      parts.join(' | ') +
      '. Lege neue Dateien nur innerhalb dieser Bereiche an.'
    );
  } catch {
    return '';
  }
}

/**
 * CALL 1: PLANER (Kommunikation)
 * - 1–3 Rückfragen ODER Mini-Plan + Dateiliste + optional 1 Snippet
 * - Kein JSON-only!
 */
export function buildPlannerMessages(
  history: LlmMessage[],
  userContent: string,
  projectFiles: ProjectFile[],
): LlmMessage[] {
  const systemLines: string[] = [];

  systemLines.push('Du bist der k1w1 PLANER. Ziel: bessere Kommunikation, bevor Code geändert wird.');
  systemLines.push('Sprache: Deutsch. Antworte kurz & klar.');
  systemLines.push(
    'Regeln:\n' +
      '1) Wenn Details fehlen: stelle 1–3 kurze Rückfragen.\n' +
      '2) Wenn genug klar ist: gib einen Mini-Plan (max. 6 Bulletpoints) + eine Dateiliste (welche Dateien du ändern würdest und warum).\n' +
      '3) Optional: 1 kleines Code-Snippet in ```ts``` oder ```tsx``` (max. ca. 20 Zeilen).\n' +
      '4) Kein Markdown-Kram außer Code-Fences. Kein JSON-Array in diesem Call.',
  );

  const pathHint = buildAllowedPathHint();
  if (pathHint) systemLines.push(pathHint);

  const systemMessage: LlmMessage = { role: 'system', content: systemLines.join('\n\n') };

  const snapshot = buildProjectSnapshot(projectFiles);
  const projectMessage: LlmMessage = {
    role: 'system',
    content: 'Kontext – aktueller Projektzustand:\n\n' + snapshot,
  };

  const MAX_HISTORY = 8;
  const trimmedHistory = history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history;

  const userTask: LlmMessage = {
    role: 'user',
    content: 'Nutzerwunsch:\n' + userContent + '\n\nBitte antworte als PLANER (Fragen ODER Plan+Dateiliste).',
  };

  return [systemMessage, projectMessage, ...trimmedHistory, userTask];
}

/**
 * CALL 2: BUILDER (strict JSON-only)
 */
export function buildBuilderMessages(
  history: LlmMessage[],
  userContent: string,
  projectFiles: ProjectFile[],
): LlmMessage[] {
  const systemIntroLines: string[] = [];

  systemIntroLines.push(
    'Du bist der k1w1 APK-Builder. Deine Aufgabe: bestehenden Expo/React-Native-Code erweitern oder verbessern. ' +
      'Du baust KEIN eigenständiges Demo-Projekt, sondern arbeitest immer im Kontext des vorhandenen Projekts.',
  );

  systemIntroLines.push(
    'Das Projekt ist ein Code-/APK-Builder. Wenn der Nutzer "Baue mir X" sagt, fügst du passende Screens/Components ' +
      'in dieses bestehende Projekt ein, aber startest KEIN komplett neues Template-Projekt.',
  );

  systemIntroLines.push(
    'AUSGABEFORMAT (sehr wichtig): Antworte IMMER NUR mit einem validen JSON-Array von { "path", "content" }. ' +
      'Es darf NICHTS vor oder nach diesem Array stehen.',
  );

  systemIntroLines.push(
    'Jedes Element muss genau diese Felder haben: "path" (string, relativer Pfad) und "content" (string, kompletter Dateiinhalt).',
  );

  systemIntroLines.push(
    'JSON-Dateien wie package.json/tsconfig/app.json müssen reines JSON sein – keine Kommentare, keine Zusatztexte.',
  );

  systemIntroLines.push(
    'Keine Platzhalter, kein Lorem Ipsum, keine TODO-Fragmente. Schreibe echten, vollständigen Code.',
  );

  systemIntroLines.push(
    'Fasse zentrale Projektdateien (package.json, app.config.js, eas.json, metro.config.js, tsconfig.json, .gitignore) NUR an, wenn der Nutzer das explizit verlangt.',
  );

  const pathHint = buildAllowedPathHint();
  if (pathHint) systemIntroLines.push(pathHint);

  const systemMessage: LlmMessage = { role: 'system', content: systemIntroLines.join('\n\n') };

  const snapshot = buildProjectSnapshot(projectFiles);
  const projectMessage: LlmMessage = {
    role: 'system',
    content:
      'Kontext – aktueller Projektzustand:\n\n' +
      snapshot +
      '\n\nNutze diesen Kontext, um nur die relevanten Dateien zu ändern oder zu ergänzen.',
  };

  const MAX_HISTORY = 10;
  const trimmedHistory = history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history;

  const userTask: LlmMessage = {
    role: 'user',
    content:
      'Aufgabe (aktuelle User-Eingabe):\n' +
      userContent +
      '\n\nDenke daran: Antworte ausschließlich mit einem JSON-Array von Dateien, ohne zusätzliche Erklärungen.',
  };

  return [systemMessage, projectMessage, ...trimmedHistory, userTask];
}

/**
 * Validator / Agent (optional)
 */
export function buildValidatorMessages(
  originalUserRequest: string,
  aiFiles: ProjectFile[],
  projectFiles: ProjectFile[],
): LlmMessage[] {
  const system: LlmMessage = {
    role: 'system',
    content:
      'Du bist ein strenger Code-Validator für den k1w1 APK-Builder. ' +
      'Du bekommst den ursprünglichen User-Wunsch und die von der Haupt-KI vorgeschlagenen Dateien. ' +
      'Prüfe Konsistenz/JSON/Pfade. Liefere ggf. ein korrigiertes JSON-Array zurück (wieder nur {path, content}).',
  };

  const snapshot = buildProjectSnapshot(projectFiles);
  const context: LlmMessage = {
    role: 'system',
    content: 'Ausschnitt des aktuellen Projekts:\n\n' + snapshot,
  };

  const user: LlmMessage = {
    role: 'user',
    content:
      'Ursprüngliche Nutzeranfrage:\n' +
      originalUserRequest +
      '\n\nHier sind die von der Haupt-KI erzeugten Dateien (JSON-Array). Prüfe sie und liefere ggf. ein verbessertes Array:',
  };

  const aiFilesJson = JSON.stringify(
    aiFiles.map((f) => ({ path: f.path, content: String(f.content ?? '') })),
    null,
    2,
  );

  const assistantDraft: LlmMessage = { role: 'assistant', content: aiFilesJson };
  return [system, context, user, assistantDraft];
}
