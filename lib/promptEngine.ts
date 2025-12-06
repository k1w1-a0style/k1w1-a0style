// lib/promptEngine.ts
// K1W1 PROMPT ENGINE V2 - TOKEN SAVER EDITION
// Ziel: Maximale Token-Effizienz, um Abstürze bei Groq/Gemini zu verhindern.

import { ProjectFile } from '../contexts/types';
import { CONFIG } from '../config';

export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

// ---------------------------------------------------------------------------
// 1. PROJECT SNAPSHOT (Intelligent gekürzt)
// ---------------------------------------------------------------------------
function buildProjectSnapshot(files: ProjectFile[]): string {
  if (!files || files.length === 0) {
    return 'Es sind aktuell noch keine Projektdateien angelegt.';
  }

  // WICHTIG: Sende nicht ALLES. Nur die Struktur und wichtige Files.
  // Ignoriere Binary Files, Lockfiles und riesige Logs.
  const CRITICAL_FILES = [
    'App.tsx',
    'package.json',
    'app.config.js',
    'theme.ts',
    'navigation/',
    'screens/',
    'components/'
  ];

  const relevantFiles = files.filter(f => {
    // Filter Binaries
    if (f.path.match(/\.(png|jpg|jpeg|gif|webp|ttf|otf|ico)$/i)) return false;
    // Filter Lockfiles
    if (f.path.includes('lock')) return false;
    
    // Behalte alles was kritisch ist oder kurz
    return true; 
  });

  // Max 10 Dateien voll anzeigen, Rest nur als Liste
  const filesToShow = relevantFiles.slice(0, 10);
  const filesToList = relevantFiles.slice(10);

  const fileContentBlocks = filesToShow.map((f) => {
    const path = f.path;
    let content = String(f.content ?? '');
    
    // Falls Datei riesig (>300 Zeilen), kürzen wir die Mitte
    const lines = content.split('\n');
    if (lines.length > 300) {
      content = lines.slice(0, 100).join('\n') + 
                `\n\n... [${lines.length - 200} Zeilen ausgeblendet] ...\n\n` + 
                lines.slice(-100).join('\n');
    }

    return `### DATEI: ${path}\n${content}`;
  });

  let snapshot = 'Ausschnitt der aktuellen Projektdateien:\n\n' + fileContentBlocks.join('\n\n');

  if (filesToList.length > 0) {
    snapshot += `\n\nWeitere vorhandene Dateien (Inhalt hier ausgeblendet um Token zu sparen): \n- ${filesToList.map(f => f.path).join('\n- ')}`;
  }

  return snapshot;
}

// ---------------------------------------------------------------------------
// 2. HISTORY CLEANER (Der Token-Retter)
// ---------------------------------------------------------------------------
function compressHistory(history: LlmMessage[]): LlmMessage[] {
  // Nimm nur die allerletzten 6 Nachrichten (das reicht für Kontext)
  const recent = history.slice(-6);

  return recent.map(msg => {
    // Wenn es eine User-Nachricht ist, lassen wir sie so (meist kurz)
    if (msg.role === 'user') return msg;

    // Wenn es eine Assistant-Nachricht ist, entfernen wir große Code-Blöcke
    // Denn der Code steht ja schon im "Project Snapshot" (aktueller Stand)
    // Wir brauchen den alten Code nicht im Chat-Verlauf.
    let content = msg.content;
    
    // Ersetze JSON-Arrays und Code-Blöcke
    content = content.replace(/```json[\s\S]*?```/g, '[(JSON Code Output entfernt)]');
    content = content.replace(/```tsx[\s\S]*?```/g, '[(TSX Code Output entfernt)]');
    content = content.replace(/```typescript[\s\S]*?```/g, '[(TS Code Output entfernt)]');
    
    // Falls die Nachricht extrem lang ist, kappen
    if (content.length > 500) {
      content = content.substring(0, 500) + '... [(Nachricht gekürzt)]';
    }

    return { ...msg, content };
  });
}

function buildAllowedPathHint(): string {
  try {
    const roots = CONFIG?.PATHS?.ALLOWED_ROOT ?? [];
    const prefixes = CONFIG?.PATHS?.ALLOWED_PREFIXES ?? [];
    return `Erlaubte Pfade: ${roots.join(', ')} | Ordner: ${prefixes.join(', ')}`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// 3. BUILDER MESSAGES (Zusammensetzen)
// ---------------------------------------------------------------------------
export function buildBuilderMessages(
  history: LlmMessage[],
  userContent: string,
  projectFiles: ProjectFile[]
): LlmMessage[] {
  
  // 1. System Prompt (Strikt & Klar)
  const systemIntroLines = [
    'Du bist der k1w1 APK-Builder. Du bist ein Experte für React Native (Expo SDK 54).',
    'Deine Aufgabe: Bestehenden Code analysieren und erweitern.',
    'ANTWORTE IMMER NUR MIT EINEM JSON-ARRAY.',
    'Format: [ { "path": "...", "content": "..." } ]',
    'Kein Markdown ausserhalb des JSON. Kein "Hier ist der Code". Nur JSON.',
    buildAllowedPathHint()
  ];

  const systemMessage: LlmMessage = {
    role: 'system',
    content: systemIntroLines.join('\n\n'),
  };

  // 2. Projekt Status (Der "State")
  const snapshot = buildProjectSnapshot(projectFiles);
  const projectMessage: LlmMessage = {
    role: 'system',
    content: `CONTEXT (Aktueller Dateistand):\n${snapshot}\n\nNutze diesen Kontext für deine Änderungen.`
  };

  // 3. Bereinigte History (Token sparen!)
  const cleanHistory = compressHistory(history);

  // 4. Aktueller User Task
  const userTask: LlmMessage = {
    role: 'user',
    content: `AUFGABE: ${userContent}\n\nAntworte jetzt mit dem JSON-Update.`
  };

  // Zusammenbauen
  return [systemMessage, projectMessage, ...cleanHistory, userTask];
}

/**
 * Validator Messages (Optional, falls du den Validator nutzt)
 */
export function buildValidatorMessages(
  originalUserRequest: string,
  aiFiles: ProjectFile[],
  projectFiles: ProjectFile[]
): LlmMessage[] {
  // Sehr simpel halten
  const system: LlmMessage = {
    role: 'system',
    content: 'Du bist ein Code-Validator. Prüfe das JSON auf Syntaxfehler und Pfade. Gib korrigiertes JSON zurück.'
  };
  
  const user: LlmMessage = {
    role: 'user',
    content: `Request: ${originalUserRequest}\nGenerated Files: ${JSON.stringify(aiFiles.map(f => ({path: f.path, content: '...'})))}`
  };

  return [system, user];
}
