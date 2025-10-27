import { AllAIProviders } from '../contexts/AIContext';
import { ProjectFile } from '../contexts/ProjectContext';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// JSON FORMAT
// ============================================================================

const JSON_RESPONSE_FORMAT = `
RESPONSE-FORMAT (nur bei Code-Aktionen):
Antworte NUR mit validem JSON-Array (KEIN Markdown, KEIN Text davor/danach):
[
  {"path": "package.json", "content": "{\\"name\\": \\"app\\"}"},
  {"path": "App.tsx", "content": "import React from 'react';..."}
]

REGELN:
1. "content" MUSS escaped String sein
2. Gib ALLE relevanten Dateien zurück (basierend auf Anfrage)
3. Nur JSON-Array, sonst nichts
`;

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const GENERATOR_SYSTEM_PROMPT = `Du bist k1w1-a0style, Experte für React Native & Expo SDK 54. Antworte auf DEUTSCH.

VERHALTEN:
- Chat/Fragen: Antworte normal als Text
- Code-Anfragen: Generiere Code im folgenden Format
${JSON_RESPONSE_FORMAT}`;

const AGENT_SYSTEM_PROMPT = `Du bist ein Code-Qualitäts-Agent. Analysiere die Roh-Antwort einer KI und formatiere sie korrekt.

AUFGABE:
1. Analysiere Generator-Antwort im Kontext
2. Extrahiere Code-Änderungen
3. Formatiere als valides JSON (siehe Format)
4. Validiere Syntax
5. WICHTIG: Behalte ALLE existierenden Projekt-Dateien bei!

${JSON_RESPONSE_FORMAT}

Output: NUR das finale JSON-Array.`;

// ============================================================================
// PROMPT BUILDER
// ============================================================================

export const buildPrompt = (
  role: 'generator' | 'agent',
  provider: AllAIProviders,
  userOrGeneratorMessage: string,
  projectFiles: ProjectFile[],
  conversationHistory: PromptMessage[],
  originalUserPrompt?: string
): PromptMessage[] => {
  let systemPromptContent = '';
  let currentMessageContent = '';

  if (role === 'generator') {
    systemPromptContent = GENERATOR_SYSTEM_PROMPT;
    currentMessageContent = userOrGeneratorMessage;
  } else {
    systemPromptContent = AGENT_SYSTEM_PROMPT;
    currentMessageContent = `User-Anfrage: "${originalUserPrompt || 'Unbekannt'}"\n\nGenerator-Antwort:\n---\n${userOrGeneratorMessage}\n---`;
  }

  let projectContext = '';
  if (projectFiles.length === 0) {
    projectContext = `\n\nPROJEKT IST LEER. Beginne mit Standard-Dateien (package.json, app.config.js, App.tsx, theme.ts, README.md).`;
  } else {
    const filePaths = projectFiles.map(f => f.path);
    const instruction =
      role === 'agent'
        ? '\nBEHALTE ALLE Dateien (außer bei explizitem Löschbefehl)!'
        : '\nÄndere nur nötige Dateien.';
    projectContext = `\n\nPROJEKT (${projectFiles.length} Dateien):\n${JSON.stringify(filePaths)}${instruction}`;
  }

  const fullSystemPrompt = `${systemPromptContent}${projectContext}`;

  const messages: PromptMessage[] = [{ role: 'system', content: fullSystemPrompt }];

  if (role === 'generator') {
    messages.push(...conversationHistory.slice(-6));
  }

  messages.push({ role: 'user', content: currentMessageContent });

  console.log(`📝 Prompt (${role}/${provider}): ${messages.length} messages`);
  return messages;
};

// ============================================================================
// HISTORY MANAGER
// ============================================================================

export class ConversationHistory {
  private history: PromptMessage[] = [];

  loadFromMessages(messages: any[]) {
    this.history = messages
      .map(msg => ({
        role: msg.user._id === 1 ? 'user' as const : 'assistant' as const,
        content: msg.text,
      }))
      .reverse();
    console.log(`🧠 History: ${this.history.length} Einträge`);
  }

  addUser(message: string) {
    this.history.push({ role: 'user', content: message });
  }

  addAssistant(message: string) {
    if (message.startsWith('[') && message.includes('"path":')) {
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed[0]?.path) {
          this.history.push({
            role: 'assistant',
            content: `[Code mit ${parsed.length} Dateien generiert]`,
          });
          return;
        }
      } catch (e) {
        // Fallthrough
      }
    }
    this.history.push({ role: 'assistant', content: message });
  }

  getHistory(): PromptMessage[] {
    return this.history;
  }

  clear() {
    this.history = [];
  }
}
