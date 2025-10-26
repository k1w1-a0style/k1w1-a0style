import { AIProvider } from '../contexts/AIContext';
import { ProjectFile, ChatMessage as AppChatMessage } from '../contexts/ProjectContext';

// Das Format, das die Supabase Function erwartet
export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ✅ STRIKTES JSON FORMAT - Wird mehrfach im Prompt erwähnt
const JSON_RESPONSE_FORMAT = `RESPONSE-FORMAT (NUR bei Code-Aktionen):
Antworte NUR mit einem JSON-Array (KEINE zusätzlichen Texte, KEIN Markdown \`\`\`json):
[
  {"path": "package.json", "content": "{\\"name\\": \\"app\\", \\"version\\": \\"1.0.0\\"}"},
  {"path": "App.tsx", "content": "import React from 'react';..."}
]

REGELN FÜR DAS JSON:
1. "content" MUSS ein valider, escaped STRING sein (auch bei JSON-Inhalt!).
2. Gib IMMER ALLE Dateien des Projekts zurück, auch die unveränderten!
3. KEIN Text vor oder nach dem JSON-Array.`;

// 1. MODELLSPEZIFISCHE SYSTEM-PROMPTS (Verschärft!)
const SYSTEM_PROMPTS: Record<AIProvider, string> = {
  groq: `Du bist k1w1-a0style, Experte für React Native & Expo SDK 54. Antworte IMMER auf DEUTSCH.
Aufgabe: Generiere/Modifiziere App-Code basierend auf User-Anweisungen.

VERHALTEN:
- Chat/Fragen ("wie gehts", "erkläre"): Antworte normal als Text.
- Code-Anweisungen ("baue", "ändere", "fixe"): Generiere Code und befolge EXAKT das ${JSON_RESPONSE_FORMAT}`, // ✅ Format explizit eingefügt

  gemini: `Du bist k1w1-a0style, Experte für React Native & Expo SDK 54. Antworte IMMER auf DEUTSCH.
Aufgabe: Generiere/Modifiziere App-Code.

VERHALTEN:
- Chat/Fragen: Antworte normal als Text.
- Code-Anweisungen ("baue", "ändere"): Befolge EXAKT das ${JSON_RESPONSE_FORMAT}`, // ✅ Format explizit eingefügt

  openai: `Du bist k1w1-a0style, Experte für React Native & Expo SDK 54. Antworte auf Deutsch.
Aufgabe: Generiere/Modifiziere App-Code.

VERHALTEN:
- Chat/Fragen: Antworte normal als Text.
- Code-Anweisungen ("baue", "ändere"): Befolge EXAKT das ${JSON_RESPONSE_FORMAT}`, // ✅ Format explizit eingefügt

  anthropic: `Du bist k1w1-a0style, Experte für React Native & Expo SDK 54. Antworte auf Deutsch.
Aufgabe: Generiere/Modifiziere App-Code.

VERHALTEN:
- Chat/Fragen: Antworte normal als Text.
- Code-Anweisungen ("baue", "ändere"): Befolge EXAKT das ${JSON_RESPONSE_FORMAT}` // ✅ Format explizit eingefügt
};

// 2. DER PROMPT-BUILDER (Angepasst für besseren Template-Hinweis)
export const buildPrompt = (
  provider: AIProvider,
  userMessage: string,
  projectFiles: ProjectFile[],
  conversationHistory: PromptMessage[]
): PromptMessage[] => {

  const systemPrompt = SYSTEM_PROMPTS[provider];

  // ✅ Verbesserter Kontext für leere Projekte
  let projectContext = "";
  if (projectFiles.length === 0) {
      projectContext = `\n\nPROJEKT IST AKTUELL LEER. Beginne mit diesen 5 Standard-Dateien als Basis:\n- package.json\n- app.config.js\n- App.tsx\n- theme.ts\n- README.md\n(Du musst diese Basis-Dateien im ersten Schritt generieren!)`;
  } else {
      // Sende nur Pfade, um Token zu sparen, aber erwähne, dass der Inhalt existiert.
      const filePaths = projectFiles.map(f => f.path);
      projectContext = `\n\nAKTUELLER PROJEKT-STATUS (${projectFiles.length} Dateien):\n${JSON.stringify(filePaths)}\nBEHALTE ALLE EXISTIERENDEN DATEIEN bei und modifiziere sie nur, wenn nötig.`;
  }

  const fullSystemPrompt = `${systemPrompt}${projectContext}`;

  const messages: PromptMessage[] = [ { role: 'system', content: fullSystemPrompt } ];
  messages.push(...conversationHistory.slice(-6)); // Letzte 6 Nachrichten
  messages.push({ role: 'user', content: userMessage });

  console.log(`📝 Prompt-Builder: ${provider}, History: ${conversationHistory.length}, Messages total: ${messages.length}`);
  // console.log("System Prompt:", fullSystemPrompt); // Zum Debuggen einkommentieren
  return messages;
};


// 3. DER ERINNERUNGSSPEICHER (HISTORY-MANAGER) - Unverändert
export class ConversationHistory {
  private history: PromptMessage[] = [];

  loadFromMessages(messages: AppChatMessage[]) {
    this.history = messages
      .map(msg => ({ role: msg.user._id === 1 ? 'user' : 'assistant', content: msg.text }))
      .reverse();
    console.log(`🧠 History geladen (${this.history.length} Einträge)`);
  }

  addUser(message: string) { this.history.push({ role: 'user', content: message }); }

  addAssistant(message: string) {
    // Kurze Bestätigung statt langem JSON in History speichern
    if (message.startsWith('[') && message.includes('"path":')) {
      try {
        const parsed = JSON.parse(message); // Hier ist Standard-Parse OK
        if (Array.isArray(parsed) && parsed[0]?.path) {
          this.history.push({ role: 'assistant', content: `[Code mit ${parsed.length} Dateien generiert/aktualisiert]` });
          return;
        }
      } catch (e) { /* Fällt durch */ }
    }
    this.history.push({ role: 'assistant', content: message });
  }
  getHistory(): PromptMessage[] { return this.history; }
  clear() { this.history = []; }
}

