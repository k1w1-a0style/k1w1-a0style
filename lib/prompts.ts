import { AllAIProviders } from '../contexts/AIContext';
import { ProjectFile, ChatMessage as AppChatMessage } from '../contexts/ProjectContext';
import { v4 as uuidv4 } from 'uuid';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// RESPONSE FORMAT DEFINITION
// ============================================================================
const JSON_RESPONSE_FORMAT = `
ANTWORT NUR als valides JSON-Array (KEIN Markdown, KEINE Erklärung):

[
  {"path":"package.json","content":"{\\"name\\":\\"musikplayer\\",\\"version\\":\\"1.0.0\\"}"},
  {"path":"App.tsx","content":"import React from 'react';\\nexport default function App() {...}"}
]

KRITISCHE REGELN:
✅ NUR Dateien die NEU oder GEÄNDERT sind
✅ "content" MUSS escaped String sein (Newlines als \\n)
✅ Valides JSON - sonst Fehler!
❌ NIEMALS "name" in package.json ändern (außer explizit gefordert)
❌ NIEMALS README2.md wenn README.md existiert - UPDATE stattdessen!
❌ KEINE Duplikate (README2, README3 etc.)
`;

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================
const GENERATOR_SYSTEM_PROMPT = `
Du bist k1w1-a0style Code Generator für Expo SDK 54 + React Native.

VERHALTEN:
1. Chat/Fragen → Antworte als normaler Text
2. Code-Anfragen ("baue", "erstelle", "ändere") → Generiere JSON

WENN Code generiert wird:
${JSON_RESPONSE_FORMAT}

WICHTIGE CONSTRAINTS:
- Expo SDK 54.0.18
- React Native 0.81.4
- TypeScript strict mode
- Neon-Grün Theme (#00FF00)
- Mobile-first Design

VERBOTEN:
- Namen in package.json ändern (außer explizit gefordert)
- Duplikate erstellen (README2, README3 etc.)
- Bundle IDs oder Slugs ändern
`;

const AGENT_SYSTEM_PROMPT = `
Du bist der Quality Agent. DEINE EINZIGE AUFGABE ist es, den Generator-Output zu validieren und zu korrigieren.
Deine Regeln sind in <AGENT_CONSTRAINTS> gekapselt und haben die HÖCHSTE PRIORITÄT.

<AGENT_CONSTRAINTS>
1. Prüfe Generator-Antwort auf Valides JSON.
2. Prüfe gegen die <FILE_CONTEXT> und die 🚨 GESCHÜTZTER NAME Anweisung (siehe System-Prompt).
3. Korrigiere alle Duplikate (z.B. README2.md in README.md umbenennen), ungültige Namen oder Datei-Fehler.
4. Gib NUR das finale, korrigierte JSON-Array zurück.
5. WENN NICHT VALIDE ODER NICHT KORRIGIERBAR: Gib GENAU dieses leere Array zurück: [].
</AGENT_CONSTRAINTS>

${JSON_RESPONSE_FORMAT}
`;

const SYSTEM_PROMPTS: Record<AllAIProviders, string> = {
  groq: GENERATOR_SYSTEM_PROMPT,
  gemini: AGENT_SYSTEM_PROMPT,
  openai: GENERATOR_SYSTEM_PROMPT,
  anthropic: GENERATOR_SYSTEM_PROMPT,
};

// ============================================================================
// PROMPT BUILDER FUNCTION
// ============================================================================
export const buildPrompt = (
  role: 'generator' | 'agent',
  provider: AllAIProviders,
  userOrGeneratorMessage: string,
  projectFiles: ProjectFile[],
  conversationHistory: AppChatMessage[],
  originalUserPrompt?: string
): PromptMessage[] => {
  let systemPromptContent = SYSTEM_PROMPTS[provider] || GENERATOR_SYSTEM_PROMPT;
  let currentMessageContent = '';

  // Build message content based on role
  if (role === 'generator') {
    currentMessageContent = userOrGeneratorMessage;
  } else {
    // Agent gets both: original request AND generator response
    currentMessageContent = `
<INPUT_FOR_AGENT>
ORIGINAL USER REQUEST: "${originalUserPrompt || 'Unbekannt'}"

GENERATOR ANTWORTETE:
---
${userOrGeneratorMessage}
---
</INPUT_FOR_AGENT>

DEINE AUFGABE: Führe die Regeln in <AGENT_CONSTRAINTS> strikt aus.
`;
  }

  // ============================================================================
  // PROJECT CONTEXT BUILDING
  // ============================================================================
  let projectContext = '';

  if (projectFiles.length === 0) {
    // Empty project
    projectContext = `

📁 PROJEKT IST LEER

Erstelle Standard-Struktur:
- package.json (name: "meine-app")
- app.config.js (Expo config)
- App.tsx (Entry point)
- theme.ts (Neon-Grün Theme)
- README.md (Dokumentation)`;
  } else {
    // Project has files
    const fileCount = projectFiles.length;
    projectContext = `

📊 PROJEKT STATUS: ${fileCount} Dateien vorhanden`;

    // ============================================================================
    // DETAILED FILE LIST FOR AGENT (CRITICAL!)
    // ============================================================================
    if (role === 'agent') {
      // Agent gets detailed list and strict rules
      projectContext += `

<FILE_CONTEXT>
🗂️ EXISTIERENDE DATEIEN IM PROJEKT (NUR DIESE EXISTIEREN!):
────────────────────────────────────`;

      projectFiles.forEach((file, idx) => {
        const lines = file.content.split('\n').length;
        const size = file.content.length;
        projectContext += `
${idx + 1}. ${file.path} (${lines} Zeilen, ${size} Zeichen)`;
      });

      projectContext += `
────────────────────────────────────
</FILE_CONTEXT>
`;
    } else {
      // Generator gets simple list
      const paths = projectFiles.map((f) => f.path);
      projectContext += `

Dateien: ${JSON.stringify(paths)}`;
    }

    // ============================================================================
    // NAME PROTECTION (für beide Rollen)
    // ============================================================================
    const pkgFile = projectFiles.find((f) => f.path === 'package.json');
    let protectedName = 'UNBEKANNT';
    if (pkgFile && pkgFile.content) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        if (pkg.name) {
          protectedName = pkg.name;
        }
      } catch (e) {
        // Ignoriert
      }
    }

    projectContext += `

🚨 GESCHÜTZTER NAME: "${protectedName}"
Dieser Name (in package.json) darf NIEMALS geändert werden (außer explizit gefordert)!`;

    // App config protection
    const appConfigFile = projectFiles.find(
      (f) => f.path === 'app.config.js' || f.path === 'app.json'
    );
    if (appConfigFile) {
      projectContext += `
⚠️ app.config vorhanden - Namen/Slugs NICHT ändern!`;
    }
  }

  // ============================================================================
  // BUILD FINAL PROMPT
  // ============================================================================
  const fullSystemPrompt = `${systemPromptContent}${projectContext}`;
  const messages: PromptMessage[] = [{ role: 'system', content: fullSystemPrompt }];

  // CRITICAL FIX: BOTH GET SAME HISTORY!
  const HISTORY_COUNT = 6;
  const historyToUse = conversationHistory.slice(-HISTORY_COUNT);
  messages.push(...historyToUse.map(msg => ({ role: msg.user._id === 1 ? 'user' : 'assistant', content: msg.text } as PromptMessage)));

  // Add current message
  messages.push({ role: 'user', content: currentMessageContent });

  // Debug logging
  console.log(`📝 Prompt (${role}/${provider}): ${messages.length} messages`);
  console.log(`   → System: 1, History: ${historyToUse.length}, Current: 1`);

  if (messages.length < 8) {
    console.warn(`⚠️ WARNUNG: Prompt hat nur ${messages.length} messages! Dies kann zu Vergesslichkeit führen.`);
  }

  return messages;
};

// ============================================================================
// CONVERSATION HISTORY CLASS (Muss unberührt bleiben, da sie aus dem Log stammt)
// ============================================================================
export class ConversationHistory {
    private history: PromptMessage[] = [];

    loadFromMessages(messages: AppChatMessage[]) {
        this.history = messages
            .map((msg) => ({
                role: (msg.user._id === 1 ? 'user' : 'assistant') as 'user' | 'assistant',
                content: msg.text,
                user: msg.user,
            }))
            .reverse();
        console.log(`🧠 History geladen (${this.history.length} Einträge)`);
    }

    addUser(message: string) {
        this.history.push({ role: 'user', content: message });
    }

    addAssistant(message: string) {
        if (message.startsWith('[') && message.includes('"path":')) {
            try {
                const parsed = JSON.parse(message);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].path) {
                    const files = parsed.map((f: any) => f.path).join(', ');
                    const summary = `[Code Update: ${parsed.length} Dateien geändert: ${files}]`;
                    this.history.push({ role: 'assistant', content: summary });
                    return;
                }
            } catch (e) {
                // Fallthrough
            }
        }
        this.history.push({ role: 'assistant', content: message });
    }

    getHistory(): AppChatMessage[] {
      // Temporäre Konvertierung für den Aufruf im Prompt Builder
      return this.history.map(msg => ({
          text: msg.content,
          _id: uuidv4(),
          createdAt: new Date(),
          user: { _id: msg.role === 'user' ? 1 : 2, name: msg.role === 'user' ? 'User' : 'AI' },
      })) as AppChatMessage[];
  }

    clear() {
        this.history = [];
        console.log('🧠 History geleert');
    }

    debug() {
        console.log('=== CONVERSATION HISTORY ===');
        this.history.forEach((msg, idx) => {
            console.log(`${idx}. [${msg.role}]: ${msg.content.substring(0, 100)}...`);
        });
        console.log('===========================');
    }
}

