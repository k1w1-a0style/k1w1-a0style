import { AllAIProviders, AIProvider } from '../contexts/AIContext';
import { ProjectFile, ChatMessage as AppChatMessage } from '../contexts/ProjectContext';

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

JSON REGELN:
1. "content" MUSS escaped String sein.
2. Gib NUR die Dateien zurück, die NEU oder GEÄNDERT sind. (Der Client managed das Mergen).
3. Nur JSON-Array, sonst nichts.`;

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================
const GENERATOR_SYSTEM_PROMPT = `Du bist k1w1-a0style, Experte für React Native & Expo SDK 54. Antworte auf DEUTSCH.
VERHALTEN:
- Chat/Fragen: Antworte normal als Text.
- Code-Anfragen ("baue", "ändere"): Generiere Code. Versuche, dieses Format zu nutzen (Code-Korrektheit ist wichtiger):
${JSON_RESPONSE_FORMAT}`;

const AGENT_SYSTEM_PROMPT = `Du bist ein Code-Qualitäts-Agent. Analysiere die Roh-Antwort einer KI und formatiere sie korrekt.
AUFGABE:
1. Analysiere Generator-Antwort im Kontext.
2. Extrahiere Code-Änderungen.
3. Formatiere als valides JSON (siehe Format).
4. Validiere Syntax.
5. WICHTIG: Gib NUR die NEUEN oder GEÄNDERTEN Dateien als JSON zurück.
${JSON_RESPONSE_FORMAT}
Output: NUR das finale JSON-Array.`;

// Mapping der Provider zu ihren System-Prompts
const SYSTEM_PROMPTS: Record<AllAIProviders, string> = {
    groq: GENERATOR_SYSTEM_PROMPT,
    gemini: AGENT_SYSTEM_PROMPT, // Gemini nutzt standardmäßig den Agenten-Prompt
    openai: GENERATOR_SYSTEM_PROMPT, // Fallback
    anthropic: GENERATOR_SYSTEM_PROMPT, // Fallback
};

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
    systemPromptContent = SYSTEM_PROMPTS[provider] || GENERATOR_SYSTEM_PROMPT;
    currentMessageContent = userOrGeneratorMessage; // User-Nachricht
  } else { // role === 'agent'
    systemPromptContent = SYSTEM_PROMPTS[provider] || AGENT_SYSTEM_PROMPT;
    currentMessageContent = `Ursprüngliche User-Anfrage: "${originalUserPrompt || 'Unbekannt'}"\n\nGenerator-Antwort:\n---\n${userOrGeneratorMessage}\n---`;
  }

  let projectContext = '';
  if (projectFiles.length === 0) {
    projectContext = `\n\nPROJEKT IST LEER. Beginne mit Standard-Dateien (package.json, app.config.js, App.tsx, theme.ts, README.md).`;
  } else {
    const filePaths = projectFiles.map(f => f.path);
    const instruction = role === 'agent'
        ? '\nDein Job ist es, die Generator-Antwort in valides JSON (nur neue/geänderte Dateien) zu formatieren.'
        : '\nÄndere nur nötige Dateien basierend auf der Anfrage.';
    projectContext = `\n\nAKTUELLER PROJEKT-STATUS (${projectFiles.length} Dateien):\n${JSON.stringify(filePaths)}${instruction}`;
  }

  const fullSystemPrompt = `${systemPromptContent}${projectContext}`;

  const messages: PromptMessage[] = [{ role: 'system', content: fullSystemPrompt }];

  if (role === 'generator') {
    messages.push(...conversationHistory.slice(-6)); // Letzte 6 Nachrichten für Generator
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

  loadFromMessages(messages: AppChatMessage[]) {
    this.history = messages
      .map(msg => ({
        role: (msg.user._id === 1 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.text,
      }))
      .reverse(); // Konvertiere App-Format (neu->alt) zu API-Format (alt->neu)
    console.log(`🧠 History geladen (${this.history.length} Einträge)`);
  }

  addUser(message: string) {
    this.history.push({ role: 'user', content: message });
  }

  addAssistant(message: string) {
    // Kurze Bestätigung statt langem JSON in History speichern
    if (message.startsWith('[') && message.includes('"path":')) {
      try {
        // Nutze try-catch, falls JSON invalide ist
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed[0]?.path) {
          this.history.push({
            role: 'assistant',
            content: `[Code mit ${parsed.length} Dateien generiert/aktualisiert]`,
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

