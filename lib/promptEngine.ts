// lib/promptEngine.ts
// Zentrale Prompt-Logik für den k1w1 APK-Builder
// Ziel: KI versteht, dass wir ein bestehenden Expo/React-Native-Code-Builder sind
// und liefert NUR ein JSON-Array aus { path, content } ohne Gelaber.

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

  // Max. 20 Dateien in der Übersicht, damit der Prompt nicht explodiert
  const MAX_FILES = 20;
  const MAX_LINES_PER_FILE = 40;

  const limitedFiles = [...files]
    .slice(0, MAX_FILES)
    .map((f) => {
      const path = f.path;
      const content = String(f.content ?? '');
      const lines = content.split('\n').slice(0, MAX_LINES_PER_FILE);
      const joined = lines.join('\n');

      return `# ${path}\n${joined}`;
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
 * Baut die Messages für den Builder-Call.
 * history: bisheriger Chatverlauf (user/assistant)
 * userContent: letzte User-Eingabe
 * projectFiles: aktueller Projektzustand
 */
export function buildBuilderMessages(
  history: LlmMessage[],
  userContent: string,
  projectFiles: ProjectFile[]
): LlmMessage[] {
  const systemIntroLines: string[] = [];

  systemIntroLines.push(
    'Du bist der k1w1 APK-Builder. Deine Aufgabe: bestehenden Expo/React-Native-Code ' +
      'erweitern oder verbessern. Du baust KEIN eigenständiges Demo-Projekt, ' +
      'sondern arbeitest immer im Kontext des vorhandenen Projekts.'
  );

  systemIntroLines.push(
    'Das Projekt ist ein „Code-/APK-Builder“ (ähnlich Bolt, a0.dev, Lovable), ' +
      'nicht einfach nur eine Musikplayer-App. Wenn der Nutzer z.B. "Baue mir einen Musikplayer" sagt, ' +
      'sollst du passende Komponenten/Screen in dieses bestehende Projekt einfügen, ' +
      'aber KEIN komplett neues, isoliertes Template-Projekt starten.'
  );

  systemIntroLines.push(
    'AUSGABEFORMAT (sehr wichtig): Du gibst als Antwort IMMER NUR ein valides JSON-Array zurück, ' +
      'ohne Erklärungstext, ohne Kommentare außerhalb der JSON-Struktur. Beispiel:\n' +
      '[\n  { "path": "screens/Foo.tsx", "content": "/* Code ... */" },\n' +
      '  { "path": "components/Bar.tsx", "content": "/* Code ... */" }\n]\n' +
      'Es darf NICHTS vor oder nach diesem Array stehen.'
  );

  systemIntroLines.push(
    'Jedes Element muss genau diese Felder haben: "path" (string, relativer Pfad im Projekt) ' +
      'und "content" (string, kompletter Dateiinhalt).'
  );

  systemIntroLines.push(
    'JSON-Dateien wie "package.json", "tsconfig.json", "app.json" usw. müssen reines JSON sein – ' +
      'KEINE Kommentare, KEIN "// Importiere die notwendigen Bibliotheken" über dem JSON.'
  );

  systemIntroLines.push(
    'Vermeide generisches Blabla im Dateiinhalt wie "kompletter Dateiinhalt hier..." oder ' +
      '"// Neue Datei". Schreibe immer echten, vollständigen Code / echte Inhalte.'
  );

  // Core-Files nur anfassen, wenn explizit verlangt
  systemIntroLines.push(
    'Fasse zentrale Projektdateien wie "package.json", "app.config.js", "eas.json", ' +
      '"metro.config.js", ".gitignore" oder "tsconfig.json" NUR dann an, wenn der Nutzer ' +
      'das EXPLIZIT verlangt (z.B. "ändere meine package.json" oder "füge Script X hinzu"). ' +
      'Ansonsten lässt du diese Dateien UNVERÄNDERT.'
  );

  const pathHint = buildAllowedPathHint();
  if (pathHint) {
    systemIntroLines.push(pathHint);
  }

  systemIntroLines.push(
    'Wenn du neue Dateien erstellst, nutze sinnvolle, kurze Namen und halte dich an die existierende Struktur. ' +
      'Bevorzuge z.B. "screens/Name.tsx", "components/Name.tsx", "lib/Name.ts", "utils/Name.ts" usw.'
  );

  systemIntroLines.push(
    'Wenn der Nutzer nur kleine Änderungen will, ändere NUR die minimal nötigen Dateien. ' +
      'Du musst nicht jedes Mal App.tsx, package.json oder Theme komplett überschreiben.'
  );

  const systemMessage: LlmMessage = {
    role: 'system',
    content: systemIntroLines.join('\n\n'),
  };

  const snapshot = buildProjectSnapshot(projectFiles);

  const projectMessage: LlmMessage = {
    role: 'system',
    content:
      'Kontext – aktueller Projektzustand:\n\n' +
      snapshot +
      '\n\nNutze diesen Kontext, um nur die relevanten Dateien zu ändern oder zu ergänzen.',
  };

  // Chatverlauf auf die letzten paar Nachrichten begrenzen,
  // damit der Prompt nicht zu groß wird
  const MAX_HISTORY = 10;
  const trimmedHistory =
    history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history;

  // Letzte User-Nachricht nochmal explizit hervorheben
  const userTask: LlmMessage = {
    role: 'user',
    content:
      'Aufgabe (aktuelle User-Eingabe):\n' +
      userContent +
      '\n\nDenke daran: Antworte ausschließlich mit einem JSON-Array von Dateien, ' +
      'ohne zusätzliche Erklärungen.',
  };

  return [systemMessage, projectMessage, ...trimmedHistory, userTask];
}

/**
 * Optional: Messages für einen Validator-Call (zweite KI),
 * falls du später Quality-Flow stärker nutzen willst.
 * Wird aktuell evtl. noch nicht überall verwendet, ist aber vorbereitet.
 */
export function buildValidatorMessages(
  originalUserRequest: string,
  aiFiles: ProjectFile[],
  projectFiles: ProjectFile[]
): LlmMessage[] {
  const system: LlmMessage = {
    role: 'system',
    content:
      'Du bist ein strenger Code-Validator für den k1w1 APK-Builder. ' +
      'Du bekommst den ursprünglichen User-Wunsch und die von der Haupt-KI vorgeschlagenen Dateien. ' +
      'Deine Aufgabe: Prüfe, ob die Dateien sinnvoll, vollständig und konsistent sind. ' +
      'Falls sie gravierende Probleme haben (z.B. unpassende Pfade, kaputtes JSON, ' +
      'komplett falscher Projekttyp), liefere ein korrigiertes Set an Dateien zurück ' +
      '– wieder ausschließlich als JSON-Array von { "path", "content" } ohne Erklärungstext. ' +
      'Wenn die Dateien OK sind, kannst du sie unverändert zurückgeben.',
  };

  const snapshot = buildProjectSnapshot(projectFiles);

  const context: LlmMessage = {
    role: 'system',
    content:
      'Ausschnitt des aktuellen Projekts (nur zur Orientierung, muss nicht komplett repliziert werden):\n\n' +
      snapshot,
  };

  const user: LlmMessage = {
    role: 'user',
    content:
      'Ursprüngliche Nutzeranfrage:\n' +
      originalUserRequest +
      '\n\nHier sind die von der Haupt-KI erzeugten Dateien (als JSON-Array). ' +
      'Analysiere sie kritisch und liefere ein optimiertes/validiertes Array zurück:',
  };

  const aiFilesJson = JSON.stringify(
    aiFiles.map((f) => ({ path: f.path, content: String(f.content ?? '') })),
    null,
    2
  );

  const assistantDraft: LlmMessage = {
    role: 'assistant',
    content: aiFilesJson,
  };

  return [system, context, user, assistantDraft];
}
