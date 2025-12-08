// lib/promptEngine.ts
// K1W1 PROMPT ENGINE V3 - SMART CONTEXT EDITION
// Ziel: Intelligente Kontextauswahl für maximale Codequalität bei minimalen Tokens.

import { ProjectFile } from '../contexts/types';
import { CONFIG } from '../config';

export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

// ---------------------------------------------------------------------------
// 1. FILE PRIORITIZATION (Intelligente Sortierung)
// ---------------------------------------------------------------------------

/** Priorität einer Datei basierend auf Typ und Wichtigkeit */
function getFilePriority(path: string): number {
  const lower = path.toLowerCase();
  
  // Höchste Priorität: Kern-Dateien
  if (lower === 'app.tsx' || lower === 'app.js') return 100;
  if (lower === 'package.json') return 95;
  if (lower.includes('theme')) return 90;
  if (lower.includes('config') && !lower.includes('babel') && !lower.includes('metro')) return 85;
  
  // Hohe Priorität: Navigation & Entry Points
  if (lower.includes('navigation')) return 80;
  if (lower.includes('index.')) return 75;
  
  // Mittlere Priorität: Screens & Components
  if (lower.includes('screen')) return 70;
  if (lower.includes('component')) return 65;
  
  // Normale Priorität: Hooks, Contexts, Utils
  if (lower.includes('hook')) return 60;
  if (lower.includes('context')) return 55;
  if (lower.includes('util') || lower.includes('helper')) return 50;
  if (lower.includes('lib/')) return 45;
  if (lower.includes('service') || lower.includes('api')) return 40;
  
  // Niedrige Priorität: Types, Constants
  if (lower.includes('type')) return 30;
  if (lower.includes('constant')) return 25;
  
  // Sehr niedrig: Docs, Configs
  if (lower.endsWith('.md')) return 10;
  if (lower.includes('.config.')) return 5;
  
  return 35; // Default
}

/** Prüft ob eine Datei für den Kontext relevant ist */
function isRelevantFile(path: string): boolean {
  const lower = path.toLowerCase();
  
  // Ignorieren: Binaries, Locks, Generated
  if (lower.match(/\.(png|jpg|jpeg|gif|webp|svg|ttf|otf|ico|woff|woff2|eot)$/i)) return false;
  if (lower.includes('lock')) return false;
  if (lower.includes('node_modules')) return false;
  if (lower.includes('.git/')) return false;
  if (lower.includes('dist/') || lower.includes('build/')) return false;
  if (lower.endsWith('.map')) return false;
  
  return true;
}

/** Schätzt Token-Count grob (4 Zeichen ≈ 1 Token) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// 2. PROJECT SNAPSHOT (Intelligent gekürzt)
// ---------------------------------------------------------------------------
function buildProjectSnapshot(files: ProjectFile[], userRequest: string = ''): string {
  if (!files || files.length === 0) {
    return 'Es sind aktuell noch keine Projektdateien angelegt.';
  }

  // Filtere und sortiere Dateien nach Relevanz
  const relevantFiles = files
    .filter(f => isRelevantFile(f.path))
    .sort((a, b) => getFilePriority(b.path) - getFilePriority(a.path));

  // Finde Dateien die im User-Request erwähnt werden
  const requestLower = userRequest.toLowerCase();
  const mentionedFiles = relevantFiles.filter(f => {
    const fileName = f.path.split('/').pop()?.toLowerCase() || '';
    const baseName = fileName.replace(/\.(tsx?|jsx?|json)$/i, '');
    return requestLower.includes(baseName) || requestLower.includes(fileName);
  });

  // Budget-Management: ~8000 Tokens für Kontext
  const MAX_CONTEXT_TOKENS = 8000;
  const MAX_FILES_FULL = 15;
  const MAX_FILE_LINES = 250;
  
  let usedTokens = 0;
  const filesToShow: ProjectFile[] = [];
  const filesToList: string[] = [];

  // Erst erwähnte Dateien hinzufügen
  for (const f of mentionedFiles) {
    if (filesToShow.length >= MAX_FILES_FULL) break;
    const tokens = estimateTokens(f.content);
    if (usedTokens + tokens < MAX_CONTEXT_TOKENS) {
      filesToShow.push(f);
      usedTokens += tokens;
    }
  }

  // Dann nach Priorität auffüllen
  for (const f of relevantFiles) {
    if (filesToShow.length >= MAX_FILES_FULL) break;
    if (filesToShow.some(s => s.path === f.path)) continue;
    
    const tokens = estimateTokens(f.content);
    if (usedTokens + tokens < MAX_CONTEXT_TOKENS) {
      filesToShow.push(f);
      usedTokens += tokens;
    } else {
      filesToList.push(f.path);
    }
  }

  // Rest als Liste
  for (const f of relevantFiles) {
    if (!filesToShow.some(s => s.path === f.path) && !filesToList.includes(f.path)) {
      filesToList.push(f.path);
    }
  }

  // Dateien mit Content zusammenbauen
  const fileContentBlocks = filesToShow.map((f) => {
    const path = f.path;
    let content = String(f.content ?? '');
    
    // Falls Datei riesig, intelligent kürzen
    const lines = content.split('\n');
    if (lines.length > MAX_FILE_LINES) {
      const head = lines.slice(0, 80).join('\n');
      const tail = lines.slice(-60).join('\n');
      content = `${head}\n\n// ... [${lines.length - 140} Zeilen ausgeblendet - vollständiger Code im Projekt] ...\n\n${tail}`;
    }

    return `### ${path}\n\`\`\`${getFileExtension(path)}\n${content}\n\`\`\``;
  });

  let snapshot = '📁 PROJEKTDATEIEN:\n\n' + fileContentBlocks.join('\n\n');

  if (filesToList.length > 0) {
    const maxList = 30;
    const listedFiles = filesToList.slice(0, maxList);
    const remaining = filesToList.length - maxList;
    
    snapshot += `\n\n📋 WEITERE DATEIEN (${filesToList.length}):\n`;
    snapshot += listedFiles.map(p => `  • ${p}`).join('\n');
    
    if (remaining > 0) {
      snapshot += `\n  ... und ${remaining} weitere`;
    }
  }

  // Token-Info für Debug
  const totalTokens = estimateTokens(snapshot);
  console.log(`[PromptEngine] Snapshot: ${filesToShow.length} Dateien vollständig, ${filesToList.length} gelistet, ~${totalTokens} Tokens`);

  return snapshot;
}

/** Extrahiert die Dateiendung für Syntax-Highlighting */
function getFileExtension(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const extMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'json': 'json',
    'md': 'markdown',
    'css': 'css',
    'scss': 'scss',
    'html': 'html',
    'yml': 'yaml',
    'yaml': 'yaml',
  };
  return extMap[ext] || ext;
}

// ---------------------------------------------------------------------------
// 3. HISTORY CLEANER (Der Token-Retter)
// ---------------------------------------------------------------------------
function compressHistory(history: LlmMessage[]): LlmMessage[] {
  // Nimm nur die allerletzten 8 Nachrichten (besserer Kontext)
  const recent = history.slice(-8);

  return recent.map((msg, idx) => {
    // User-Nachrichten: Behalten (meist kurz)
    if (msg.role === 'user') {
      // Nur kürzen wenn wirklich sehr lang
      if (msg.content.length > 1000) {
        return {
          ...msg,
          content: msg.content.substring(0, 800) + '\n... [User-Nachricht gekürzt]',
        };
      }
      return msg;
    }

    // System-Nachrichten: Komplett behalten
    if (msg.role === 'system') return msg;

    // Assistant-Nachrichten: Code entfernen (ist im aktuellen Snapshot)
    let content = msg.content;
    
    // Ersetze JSON-Arrays und Code-Blöcke mit Zusammenfassung
    content = content.replace(/```json[\s\S]*?```/g, '[JSON-Antwort - siehe Projektdateien]');
    content = content.replace(/```(tsx?|jsx?|typescript|javascript)[\s\S]*?```/g, '[Code-Antwort - siehe Projektdateien]');
    content = content.replace(/\[[\s\S]{500,}\]/g, '[Große JSON-Struktur entfernt]');
    
    // Behalte die Zusammenfassung am Anfang
    const lines = content.split('\n');
    const summaryLines = lines.filter(l => 
      l.startsWith('✅') || 
      l.startsWith('📄') || 
      l.startsWith('🤖') || 
      l.startsWith('⏭') ||
      l.includes('erfolgreich') ||
      l.includes('Dateien')
    );
    
    if (summaryLines.length > 0 && content.length > 400) {
      content = summaryLines.slice(0, 5).join('\n');
    } else if (content.length > 400) {
      content = content.substring(0, 350) + '\n... [Antwort gekürzt]';
    }

    return { ...msg, content };
  });
}

function buildAllowedPathHint(): string {
  try {
    const roots = CONFIG?.PATHS?.ALLOWED_ROOT ?? [];
    const prefixes = CONFIG?.PATHS?.ALLOWED_PREFIXES ?? [];
    return `Erlaubte Pfade: ${roots.slice(0, 5).join(', ')} | Ordner: ${prefixes.slice(0, 8).join(', ')}`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// 4. BUILDER MESSAGES (Zusammensetzen)
// ---------------------------------------------------------------------------
export function buildBuilderMessages(
  history: LlmMessage[],
  userContent: string,
  projectFiles: ProjectFile[]
): LlmMessage[] {
  
  // 1. System Prompt (Strikt & Klar)
  const systemPrompt = `Du bist der k1w1 APK-Builder - ein Experte für React Native mit Expo SDK 54.

WICHTIGE REGELN:
1. ANTWORTE IMMER NUR MIT EINEM JSON-ARRAY: [ { "path": "...", "content": "..." } ]
2. Kein Markdown, keine Erklärungen - nur das JSON-Array
3. Schreibe VOLLSTÄNDIGEN Code - keine Platzhalter wie "// ... rest of code"
4. Nutze TypeScript (.tsx/.ts) für alle Komponenten
5. Importiere immer alle benötigten Module
6. ${buildAllowedPathHint()}

STIL:
- Modernes React Native mit Hooks
- Saubere, lesbare Komponenten
- theme.ts für Farben verwenden
- Deutsche Kommentare sind OK`;

  const systemMessage: LlmMessage = {
    role: 'system',
    content: systemPrompt,
  };

  // 2. Projekt Snapshot (mit User-Request für bessere Relevanz)
  const snapshot = buildProjectSnapshot(projectFiles, userContent);
  const projectMessage: LlmMessage = {
    role: 'system',
    content: `📦 AKTUELLER PROJEKTSTAND:\n\n${snapshot}\n\n⚡ Nutze diese Dateien als Basis für deine Änderungen.`
  };

  // 3. Bereinigte History
  const cleanHistory = compressHistory(history);

  // 4. Aktueller User Task
  const userTask: LlmMessage = {
    role: 'user',
    content: `🎯 AUFGABE: ${userContent}\n\nAntworte NUR mit dem JSON-Array der geänderten/neuen Dateien.`
  };

  // Zusammenbauen
  const messages = [systemMessage, projectMessage, ...cleanHistory, userTask];
  
  // Token-Budget-Check
  const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  console.log(`[PromptEngine] Total Messages: ${messages.length}, ~${totalTokens} Tokens`);
  
  if (totalTokens > 15000) {
    console.warn(`[PromptEngine] ⚠️ Hohe Token-Anzahl (${totalTokens}) - könnte zu Timeout führen`);
  }

  return messages;
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
