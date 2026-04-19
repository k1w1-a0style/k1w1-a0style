// lib/promptEngine.ts
// Zentrale Prompt-Logik für den k1w1 APK-Builder

import { buildEffectiveChatWriteHint } from './effectiveWritePolicy';
import { sanitizeFileContentForPrompt, sanitizeTextForLlm } from './promptSanitizer';
import { trimPromptContextToBudget } from './aiContextBudget';
import { CONFIG } from '../config';

import type { ProjectFile } from "../shared/types/project";
export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

// Hilfsfunktion: kleine, komprimierte Projektübersicht für den Prompt
function collectFocusTerms(userFocus: string): string[] {
  const lowered = String(userFocus ?? '').toLowerCase();
  const rawTokens = lowered.match(/[a-z0-9_.\/-]{3,}/g) ?? [];
  const stop = new Set([
    'und', 'oder', 'aber', 'nicht', 'mit', 'ohne', 'dass', 'dies', 'eine', 'einen', 'der', 'die', 'das', 'den', 'dem', 'des',
    'für', 'von', 'auf', 'ist', 'sind', 'bitte', 'kann', 'können', 'soll', 'sollte', 'mach', 'mache', 'baue', 'bauen',
    'the', 'and', 'for', 'with', 'without', 'from', 'into', 'onto', 'that', 'this', 'these', 'those',
    'please', 'can', 'could', 'should', 'would', 'make', 'create', 'add', 'update', 'improve',
  ]);

  return [...new Set(rawTokens.filter((t) => !stop.has(t)).slice(0, 24))];
}

function fileRelevanceScore(file: ProjectFile, focusTerms: string[]): number {
  const path = String(file.path ?? '').toLowerCase();
  const content = String(file.content ?? '').toLowerCase();
  let score = 0;

  for (const term of focusTerms) {
    if (!term) continue;
    if (path.includes(term)) score += 8;
    if (content.includes(term)) score += 3;
  }

  if (/\b(app|screen|chat|prompt|normalizer|validator|builder|planner|flow)\b/.test(path)) score += 2;
  if (/(^|\/)readme\.md$|(^|\/)todo\.md$|(^|\/)project_checklog\.md$/i.test(path)) score += 1;
  return score;
}

function buildProjectSnapshot(files: ProjectFile[], userFocus = ''): string {
  if (!files || files.length === 0) {
    return 'Es sind aktuell noch keine Projektdateien angelegt.';
  }

  const MAX_FILES = CONFIG.PROMPT.MAX_SNAPSHOT_FILES;
  const MAX_LINES_PER_FILE = CONFIG.PROMPT.MAX_LINES_PER_FILE;
  const focusTerms = collectFocusTerms(userFocus);

  const prioritized = [...files]
    .map((f, idx) => ({ f, idx, score: fileRelevanceScore(f, focusTerms) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.idx - b.idx;
    })
    .slice(0, MAX_FILES)
    .map(({ f, score }) => {
      const path = f.path;
      const content = sanitizeFileContentForPrompt(f.path, String(f.content ?? ''));
      const lines = content.split('\n').slice(0, MAX_LINES_PER_FILE);
      const relevanceHint = score > 0 ? ` (relevance=${score})` : '';
      return `# ${path}${relevanceHint}\n${lines.join('\n')}`;
    });

  return (
    'Priorisierter Ausschnitt der aktuellen Projektdateien (gekürzt):\n\n' +
    prioritized.join('\n\n') +
    '\n\n(Hinweis: Dies ist ein priorisierter Snapshot, nicht das komplette Projekt. Nicht gezeigte Pfade koennen fehlen.)'
  );
}

function buildAllowedPathHint(): string {
  return buildEffectiveChatWriteHint();
}

const LARGE_TASK_DROPPED_FILES_THRESHOLD = 4;
const LARGE_TASK_TRIMMED_FILES_THRESHOLD = 4;

function hasLargeTaskBudgetSignal(stats: { droppedFileCount: number; trimmedFileCount: number }): boolean {
  return (
    stats.droppedFileCount >= LARGE_TASK_DROPPED_FILES_THRESHOLD ||
    stats.trimmedFileCount >= LARGE_TASK_TRIMMED_FILES_THRESHOLD
  );
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
  provider?: string | null,
): LlmMessage[] {
  const systemLines: string[] = [];

  systemLines.push('Du bist der k1w1 PLANER. Ziel: bessere Kommunikation, bevor Code geändert wird.');
  systemLines.push('Sprache: Deutsch. Antworte kurz & klar.');
  systemLines.push(
    'Regeln:\n' +
      '1) Wenn Details fehlen: stelle 1–3 kurze Rückfragen als strukturierte Slot-Liste im Format "[SLOT] <Name>: <Frage>" (kein Fließtext-Block).\n' +
      '2) Wenn genug klar ist: gib einen Mini-Plan (max. 6 Bulletpoints) + eine Dateiliste (welche Dateien du ändern würdest und warum).\n' +
      '3) Optional: 1 kleines Code-Snippet in ```ts``` oder ```tsx``` (max. ca. 20 Zeilen).\n' +
      '4) Kein Markdown-Kram außer Code-Fences. Kein JSON-Array in diesem Call.\n' +
      '5) Behaupte keine Vollrepo-Sicht: du arbeitest nur mit einem priorisierten Snapshot und den explizit benannten Pfaden.',
  );

  const pathHint = buildAllowedPathHint();
  if (pathHint) systemLines.push(pathHint);

  const systemMessage: LlmMessage = { role: 'system', content: systemLines.join('\n\n') };

  const budgeted = trimPromptContextToBudget({
    history,
    projectFiles,
    userContent,
    mode: 'planner',
    provider,
  });

  const snapshot = buildProjectSnapshot(budgeted.projectFiles, userContent);
  const projectMessage: LlmMessage = {
    role: 'system',
    content: 'Kontext – aktueller Projektzustand:\n\n' + (budgeted.note ? `[intern] ${budgeted.note}\n\n` : '') + snapshot,
  };

  const MAX_HISTORY = 8;
  const recentHistory = budgeted.history.length > MAX_HISTORY ? budgeted.history.slice(budgeted.history.length - MAX_HISTORY) : budgeted.history;

  const largeTaskPlanHint = hasLargeTaskBudgetSignal(budgeted.stats)
    ? '\n\nWichtig: Der Scope wirkt groß. Gib zuerst einen Blockplan mit 2–4 klaren Schritten (Analyse → Plan → Patch-Schritte → Recheck) und starte nur mit Block 1.'
    : '';

  const userTask: LlmMessage = {
    role: 'user',
    content:
      'Nutzerwunsch:\n' +
      sanitizeTextForLlm(userContent) +
      '\n\nBitte antworte als PLANER (Fragen ODER Plan+Dateiliste).' +
      largeTaskPlanHint,
  };

  return [systemMessage, projectMessage, ...recentHistory, userTask];
}

/**
 * CALL 2: BUILDER (strict JSON-only)
 */
export function buildBuilderMessages(
  history: LlmMessage[],
  userContent: string,
  projectFiles: ProjectFile[],
  provider?: string | null,
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
    'Du arbeitest nur mit einem priorisierten, gekürzten Snapshot des Projekts. Behaupte keine Vollrepo-Sicht und plane keine normalen Writes fuer nicht sichtbare oder guardierte Pfade.',
  );

  systemIntroLines.push(
    'Fasse zentrale Projektdateien (package.json, app.config.js, eas.json, metro.config.js, tsconfig.json, .gitignore) NUR an, wenn der Nutzer das explizit verlangt.',
  );

  const pathHint = buildAllowedPathHint();
  if (pathHint) systemIntroLines.push(pathHint);

  const systemMessage: LlmMessage = { role: 'system', content: systemIntroLines.join('\n\n') };

  const budgeted = trimPromptContextToBudget({
    history,
    projectFiles,
    userContent,
    mode: 'builder',
    provider,
  });

  const snapshot = buildProjectSnapshot(budgeted.projectFiles, userContent);
  const projectMessage: LlmMessage = {
    role: 'system',
    content:
      'Kontext – aktueller Projektzustand:\n\n' +
      (budgeted.note ? `[intern] ${budgeted.note}\n\n` : '') +
      snapshot +
      '\n\nNutze diesen Kontext, um nur die relevanten Dateien zu ändern oder zu ergänzen.',
  };

  const MAX_HISTORY = 10;
  const recentHistory = budgeted.history.length > MAX_HISTORY ? budgeted.history.slice(budgeted.history.length - MAX_HISTORY) : budgeted.history;

  const largeTaskBuildHint = hasLargeTaskBudgetSignal(budgeted.stats)
    ? '\n\nWichtig: Der Scope wirkt groß. Liefere nur den aktuell angeforderten Block als minimalen, lauffähigen Teilpatch und verschiebe weitere Schritte explizit in den nächsten Durchlauf.'
    : '';

  const userTask: LlmMessage = {
    role: 'user',
    content:
      'Aufgabe (aktuelle User-Eingabe):\n' +
      sanitizeTextForLlm(userContent) +
      '\n\nDenke daran: Antworte ausschließlich mit einem JSON-Array von Dateien, ohne zusätzliche Erklärungen.' +
      largeTaskBuildHint,
  };

  return [systemMessage, projectMessage, ...recentHistory, userTask];
}

/**
 * Validator / Agent (optional)
 */
export function buildValidatorMessages(
  originalUserRequest: string,
  aiFiles: ProjectFile[],
  projectFiles: ProjectFile[],
  provider?: string | null,
): LlmMessage[] {
  const system: LlmMessage = {
    role: 'system',
    content:
      'Du bist ein strenger Code-Validator für den k1w1 APK-Builder. ' +
      'Du bekommst den ursprünglichen User-Wunsch und die von der Haupt-KI vorgeschlagenen Dateien. ' +
      'Prüfe Konsistenz/JSON/Pfade. Liefere ggf. ein korrigiertes JSON-Array zurück (wieder nur {path, content}). ' +
      'Du siehst dabei nur einen priorisierten, gekürzten Projektausschnitt statt einer Vollrepo-Sicht.',
  };

  const budgetedProject = trimPromptContextToBudget({
    projectFiles,
    userContent: originalUserRequest,
    mode: 'validator',
    provider,
    extraTexts: aiFiles.map((file) => `${file.path}\n${String(file.content ?? '')}`),
  });
  const budgetedAiFiles = trimPromptContextToBudget({
    projectFiles: aiFiles,
    userContent: originalUserRequest,
    mode: 'validator',
    provider,
  }).projectFiles;

  const allAiPaths = [...new Set(aiFiles.map((file) => String(file.path ?? '').trim()).filter(Boolean))];
  const includedAiPaths = new Set(budgetedAiFiles.map((file) => file.path));
  const omittedAiPaths = allAiPaths.filter((path) => !includedAiPaths.has(path));

  const snapshot = buildProjectSnapshot(budgetedProject.projectFiles, originalUserRequest);
  const context: LlmMessage = {
    role: 'system',
    content:
      'Ausschnitt des aktuellen Projekts:\n\n' +
      (budgetedProject.note ? `[intern] ${budgetedProject.note}\n\n` : '') +
      snapshot,
  };

  const user: LlmMessage = {
    role: 'user',
    content:
      'Ursprüngliche Nutzeranfrage:\n' +
      sanitizeTextForLlm(originalUserRequest) +
      '\n\nHier sind die von der Haupt-KI erzeugten Dateien (JSON-Array). Prüfe sie und liefere ggf. ein verbessertes Array:',
  };

  const manifestSummary: LlmMessage = {
    role: 'system',
    content:
      'Vollständige AI-Zielpfade (auch wenn Inhalte wegen Budget gekürzt/ausgelassen sein können):\n' +
      (allAiPaths.length > 0 ? allAiPaths.map((path) => `- ${path}`).join('\n') : '- (keine)') +
      (omittedAiPaths.length > 0
        ? `\n\nNicht vollständig inline im JSON enthalten (nur Pfad sichtbar):\n${omittedAiPaths.map((path) => `- ${path}`).join('\n')}`
        : '\n\nAlle AI-Zielpfade sind vollständig im JSON enthalten.'),
  };

  const aiFilesJson = JSON.stringify(
    budgetedAiFiles.map((f) => ({
      path: f.path,
      content: sanitizeFileContentForPrompt(f.path, String(f.content ?? '')),
    })),
    null,
    2,
  );

  const assistantDraft: LlmMessage = { role: 'assistant', content: aiFilesJson };
  return [system, context, manifestSummary, user, assistantDraft];
}
