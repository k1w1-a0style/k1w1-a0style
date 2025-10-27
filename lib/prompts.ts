import { AllAIProviders, CHAT_PROVIDER, AGENT_PROVIDER } from '../contexts/AIContext';
import { ProjectFile, ChatMessage as AppChatMessage } from '../contexts/ProjectContext';

// Typ für Supabase Function
export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// PROMPT DEFINITIONS
// ============================================================================

// --- JSON Format Definition ---
const JSON_RESPONSE_FORMAT = `
RESPONSE-FORMAT (NUR bei Code-Aktionen):
Antworte NUR mit einem validen JSON-Array (KEIN Markdown \`\`\`json, KEIN Text davor/danach):
[
  {"path": "package.json", "content": "{\\"name\\": \\"app\\", \\"version\\": \\"1.0.0\\"}"},
  {"path": "App.tsx", "content": "import React from 'react';..."}
]

JSON REGELN:
1. "content" MUSS ein valider, korrekt escaped STRING sein (auch bei JSON-Inhalt!).
2. Gib ALLE relevanten Projekt-Dateien zurück. **WICHTIG:** Wenn du eine Datei änderst, schicke die geänderte Datei. Wenn du eine Datei hinzufügst, schicke die neue Datei. Du musst NICHT alle unveränderten Dateien mitschicken.
3. Nur das JSON-Array, sonst nichts.`;
// HINWEIS: Regel 2 wurde angepasst, um Token zu sparen. Der Merge passiert im Client!

// --- System Prompt für den GENERATOR (Groq) ---
const GENERATOR_SYSTEM_PROMPT = `Du bist k1w1-a0style, ein Experte für React Native & Expo SDK 54. Antworte auf DEUTSCH.
Aufgabe: Generiere/Modifiziere App-Code basierend auf User-Anweisungen und dem aktuellen Projektstatus.

VERHALTEN:
- Chat/Fragen ("wie gehts", "erkläre"): Antworte normal als Text.
- Code-Anweisungen ("baue", "ändere", "fixe"): Generiere den Code. Versuche, das folgende Format zu verwenden, aber Korrektheit des Codes ist wichtiger als perfektes JSON:
${JSON_RESPONSE_FORMAT}`;

// --- System Prompt für den AGENTEN (Gemini) ---
const AGENT_SYSTEM_PROMPT = `Du bist ein Code-Qualitäts-Agent. Deine Aufgabe ist es, die Roh-Antwort einer anderen KI (Generator) zu analysieren, zu validieren, zu formatieren und sicherzustellen, dass sie korrekt in den bestehenden Projekt-Code integriert werden kann. Antworte IMMER auf DEUTSCH, aber NUR mit dem finalen JSON.

INPUTS:
1. Ursprüngliche User-Anfrage.
2. Aktueller Projekt-Status (Dateipfade).
3. Roh-Antwort vom Generator.

AUFGABE:
1. Analysiere die Roh-Antwort des Generators im Kontext der User-Anfrage und des Projekt-Status.
2. Extrahiere die beabsichtigten Code-Änderungen/-Ergänzungen.
3. **FORMATIERUNG:** Erzeuge ein Ergebnis, das EXAKT dem folgenden JSON-Format entspricht. KEIN TEXT DAVOR ODER DANACH!
${JSON_RESPONSE_FORMAT}
4. **VALIDIERUNG:** Stelle sicher, dass der "content" valides, korrekt escaped String-Format hat. Korrigiere Syntaxfehler im Code, wenn möglich.
5. **VOLLSTÄNDIGKEIT:** (WICHTIG!) Stelle sicher, dass ALLE Dateien, die der Generator ändern wollte oder die neu sind, im finalen JSON enthalten sind. Du musst NICHT die unveränderten Dateien aus dem Projekt-Status mitschicken.

Output: NUR das finale, valide JSON-Array mit den neuen/geänderten Dateien.`;

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

  // Wähle den System-Prompt basierend auf der ROLLE
  if (role === 'generator') {
    systemPromptContent = SYSTEM_PROMPTS[provider] || GENERATOR_SYSTEM_PROMPT; // Nimm den Provider-spezifischen (meist Groq)
    currentMessageContent = userOrGeneratorMessage; // Die Nachricht des Users
  } else { // role === 'agent'
    systemPromptContent = SYSTEM_PROMPTS[provider] || AGENT_SYSTEM_PROMPT; // Nimm den Provider-spezifischen (meist Gemini)
    currentMessageContent = `Ursprüngliche User-Anfrage: "${originalUserPrompt || 'Unbekannt'}"\n\nRoh-Antwort vom Generator:\n---\n${userOrGeneratorMessage}\n---`;
  }

  // Baue den Projekt-Kontext (nur Dateipfade senden)
  let projectContext = '';
  if (projectFiles.length === 0) {
    projectContext = `\n\nPROJEKT IST AKTUELL LEER. Beginne mit Standard-Dateien (package.json, app.config.js, App.tsx, theme.ts, README.md).`;
  } else {
    const filePaths = projectFiles.map(f => f.path);
    const instruction = role === 'agent'
        ? '\nBEHALTE ALLE DIESE DATEIEN im Projekt. Deine Aufgabe ist es, die Roh-Antwort als JSON-Array von geänderten/neuen Dateien zu formatieren.'
        : '\nÄndere nur nötige Dateien basierend auf der Anfrage.';
    projectContext = `\n\nAKTUELLER PROJEKT-STATUS (${projectFiles.length} Dateien):\n${JSON.stringify(filePaths)}${instruction}`;
  }

  const fullSystemPrompt = `${systemPromptContent}${projectContext}`;

  const messages: PromptMessage[] = [
    { role: 'system', content: fullSystemPrompt }
  ];

  // History nur für Generator-Rolle hinzufügen
  if (role === 'generator') {
      messages.push(...conversationHistory.slice(-6)); // Letzte 6 Nachrichten
  }

  messages.push({ role: 'user', content: currentMessageContent });

  console.log(`📝 Prompt (${role}/${provider}): ${messages.length} messages`);
  return messages;
};


// ============================================================================
// HISTORY MANAGER (Unverändert)
// ============================================================================
export class ConversationHistory {
  private history: PromptMessage[] = [];

  loadFromMessages(messages: AppChatMessage[]) {
    this.history = messages
      .map(msg => ({ role: (msg.user._id === 1 ? 'user' : 'assistant') as 'user' | 'assistant', content: msg.text }))
      .reverse(); // Konvertiere App-Format (neu->alt) zu API-Format (alt->neu)
    console.log(`🧠 History geladen (${this.history.length} Einträge)`);
  }

  addUser(message: string) { this.history.push({ role: 'user', content: message }); }

  addAssistant(message: string) {
    // Kurze Bestätigung statt langem JSON in History speichern
    if (message.startsWith('[') && message.includes('"path":')) {
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed[0]?.path) {
          this.history.push({ role: 'assistant', content: `[Code mit ${parsed.length} Dateien generiert/aktualisiert]` });
          return;
        }
      } catch (e) { /* Fällt durch zum normalen Speichern */ }
    }
    this.history.push({ role: 'assistant', content: message });
  }
  getHistory(): PromptMessage[] { return this.history; }
  clear() { this.history = []; }
}

