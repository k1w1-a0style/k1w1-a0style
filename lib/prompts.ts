import { AllAIProviders } from '../contexts/AIContext';
import { ProjectFile, ChatMessage } from '../contexts/types';
import { CONFIG } from '../config';
import { getCodeLineCount, ensureStringContent, normalizePath } from '../utils/chatUtils';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Gemeinsame Regeln für JSON-Responses
const SHARED_JSON_RESPONSE_RULES = `
Wenn du Code generierst, antworte NUR als valides JSON-Array mit vollständigen Dateien:

[
  {"path":"components/Button.tsx","content":"import React...\\n(VOLLSTÄNDIGER CODE)"},
  {"path":"theme.ts","content":"export const theme = {...}"}
]

Regeln:
- Escaped Strings (\\n) erforderlich
- ALLE Code-Dateien in einem der folgenden Ordner: ${CONFIG.PATHS.SRC_FOLDERS.join(', ')} (NICHT mit 'src/' präfixen)
- Ausnahmen im Root: ${CONFIG.PATHS.ALLOWED_ROOT.join(', ')}
- Mindestens ${CONFIG.VALIDATION.MIN_LINES_TSX} Zeilen (.tsx), ${CONFIG.VALIDATION.MIN_LINES_TS} Zeilen (.ts)
- Keine Platzhalter: ${CONFIG.VALIDATION.CONTENT_PATTERNS.PLACEHOLDERS.join(', ')}
- Keine Duplikate: ${CONFIG.VALIDATION.PATTERNS.DUPLICATE.source}
`;

// Generator-Prompt
const GROQ_GENERATOR_PROMPT = `
Du bist k1w1-a0style, ein Build-Assistent für Expo SDK 54 + React Native.

Aufgabe:
- Erstelle production-ready Code (Expo managed workflow)
- Nutze Functional Components, Hooks, TypeScript Typen, StyleSheet.create
- Bei Screens: React Navigation (Stack/Tab)
- Beschreibe kurz, was du machst
- Frage: "Soll ich das implementieren?" (warte auf 'ja', 'mach', 'los')

Beispiel:
User: "Füge Dark Mode hinzu"
Du: "💡 Ich erstelle:
- contexts/ThemeContext.tsx für Toggle
- theme.ts für Farben
Soll ich das implementieren?"

${SHARED_JSON_RESPONSE_RULES}

Ordner-Entscheidung:
1. Root-Dateien? → ${CONFIG.PATHS.ALLOWED_ROOT.join(', ')}
2. ${CONFIG.VALIDATION.PATTERNS.COMPONENT.source} → components/
3. ${CONFIG.VALIDATION.PATTERNS.SCREEN.source} → screens/
4. ${CONFIG.VALIDATION.PATTERNS.CONTEXT.source} → contexts/
5. ${CONFIG.VALIDATION.PATTERNS.HOOK.source} → hooks/
6. ${CONFIG.VALIDATION.PATTERNS.UTIL.source} → utils/
7. ${CONFIG.VALIDATION.PATTERNS.SERVICE.source} → services/
8. ${CONFIG.VALIDATION.PATTERNS.TYPE.source} oder .d.ts → types/
9. .tsx → components/, .ts → utils/
`;

// Agent-Prompt
const GEMINI_AGENT_PROMPT = `
Du bist der Quality Agent.

Aufgabe:
- Prüfe Generator-Output
- Korrigiere Pfade
- Entferne Platzhalter
- Stelle sicher: ${CONFIG.VALIDATION.MIN_LINES_TSX} Zeilen (.tsx), ${CONFIG.VALIDATION.MIN_LINES_TS} Zeilen (.ts)
- Gib korrigiertes JSON oder [] zurück

${SHARED_JSON_RESPONSE_RULES}

Pfad-Korrekturen:
- "Button.tsx" → "components/Button.tsx"
- "HomeScreen.tsx" → "screens/HomeScreen.tsx"
- "useAuth.ts" → "hooks/useAuth.ts"
`;

const SYSTEM_PROMPTS: Record<string, string> = {
  'generator-groq': GROQ_GENERATOR_PROMPT,
  'generator-openai': GROQ_GENERATOR_PROMPT,
  'generator-anthropic': GROQ_GENERATOR_PROMPT,
  'agent-gemini': GEMINI_AGENT_PROMPT,
  'agent-groq': GEMINI_AGENT_PROMPT,
  'agent-openai': GEMINI_AGENT_PROMPT,
};

export const buildPrompt = (
  role: 'generator' | 'agent',
  provider: AllAIProviders,
  userOrGeneratorMessage: string,
  projectFiles: ProjectFile[],
  conversationHistory: ChatMessage[],
  originalUserPrompt?: string,
): PromptMessage[] => {
  if (!userOrGeneratorMessage || typeof userOrGeneratorMessage !== 'string') {
    console.warn('⚠️ Ungültige Eingabe für userOrGeneratorMessage');
    return [{ role: 'system', content: 'Ungültige Eingabe' }];
  }

  const promptKey = `${role}-${provider}`;
  const systemPromptContent = SYSTEM_PROMPTS[promptKey] || GROQ_GENERATOR_PROMPT;
  console.log(`🤖 Prompt gewählt: ${promptKey}`);

  const MAX_PROMPT_TOKENS = 8000;
  const tokenRatioMap = CONFIG.TOKEN_RATIO as Record<string, number>;
  const tokenRatio = tokenRatioMap[provider] ?? CONFIG.TOKEN_RATIO.default;
  const estimateTokens = (text: string) => Math.ceil((text || '').length / tokenRatio);

  let currentMessageContent =
    role === 'generator'
      ? userOrGeneratorMessage
      : `
AGENT_INPUT:
ORIGINAL: "${originalUserPrompt || 'Unbekannt'}"
GENERATOR:
---
${userOrGeneratorMessage}
---
Regeln:
- ${CONFIG.VALIDATION.MIN_LINES_TSX}+ Zeilen (.tsx), ${CONFIG.VALIDATION.MIN_LINES_TS}+ Zeilen (.ts)
- Code-Dateien in ${CONFIG.PATHS.SRC_FOLDERS.join(', ')} (außer ${CONFIG.PATHS.ALLOWED_ROOT.join(', ')})
- Korrigiere Pfade
`;

  // PROJECT CONTEXT
  let projectContext = '';
  if (!projectFiles || projectFiles.length === 0) {
    projectContext = `PROJECT EMPTY: Create base structure:\n${CONFIG.PATHS.SRC_FOLDERS.map(
      (f) => `├── ${f}/`,
    ).join('\n')}`;
  } else {
    const fileCount = projectFiles.length;
    const folderSet = new Set(
      projectFiles
        .map((f) => normalizePath(f.path).split('/')[0])
        .filter((f) => CONFIG.PATHS.SRC_FOLDERS.includes(f)),
    );
    const srcFolders = Array.from(folderSet);
    const rootFiles = projectFiles.filter(
      (f) => !CONFIG.PATHS.SRC_FOLDERS.includes(normalizePath(f.path).split('/')[0]),
    );

    projectContext = `📊 Project: ${fileCount} files (${srcFolders.length} Ordner)`;
    projectContext += `\n<FILE_CONTEXT>\n🗂️ Root Files:`;

    CONFIG.PATHS.ALLOWED_ROOT.forEach((filename) => {
      const file = rootFiles.find((f) => normalizePath(f.path) === filename);
      if (file) {
        const lines = getCodeLineCount(ensureStringContent(file.content));
        projectContext += `\n✅ ${filename} (${lines} lines)`;
      }
    });

    if (srcFolders.length > 0) {
      projectContext += `\n\n📁 Ordnerstruktur:`;
      srcFolders.forEach((folder) => {
        const folderFiles = projectFiles.filter((f) =>
          normalizePath(f.path).startsWith(`${folder}/`),
        );
        projectContext += `\n📂 ${folder}/ (${folderFiles.length} files)`;
        folderFiles.forEach((f) => {
          const lines = getCodeLineCount(ensureStringContent(f.content));
          const fileName = normalizePath(f.path).split('/').pop();
          projectContext += `\n * ${fileName} (${lines} lines)`;
        });
      });
    }

    projectContext += `\n</FILE_CONTEXT>`;

    const pkgFile = projectFiles.find((f) => normalizePath(f.path) === 'package.json');
    if (pkgFile) {
      try {
        const pkg = JSON.parse(ensureStringContent(pkgFile.content));
        if (pkg.name) projectContext += `\n🚨 Protected name: "${pkg.name}"`;
      } catch {
        // ignore
      }
    }
  }

  // ggf. Kontext kürzen
  const MAX_CONTEXT_TOKENS = MAX_PROMPT_TOKENS * 0.6;
  let trimmedContext = projectContext;
  if (estimateTokens(projectContext) > MAX_CONTEXT_TOKENS) {
    const lines = projectContext.split('\n');
    const important = lines.filter(
      (l) =>
        l.includes('Project:') ||
        l.includes('Root Files:') ||
        l.includes('Ordnerstruktur:') ||
        l.startsWith('✅') ||
        l.startsWith('📂') ||
        l.startsWith('🚨') ||
        l.includes('Protected name'),
    );
    trimmedContext = important.slice(0, 20).join('\n') + '\n... (gekürzt)';
    console.warn(
      `⚠️ Project context gekürzt: ${estimateTokens(projectContext)} > ${MAX_CONTEXT_TOKENS}`,
    );
  }

  const fullSystemPrompt = `${systemPromptContent}\n${trimmedContext}`;
  const messages: PromptMessage[] = [{ role: 'system', content: fullSystemPrompt }];

  // History anhängen
  const HISTORY_COUNT = 12;
  let historyToUse = Array.isArray(conversationHistory)
    ? conversationHistory.slice(-HISTORY_COUNT)
    : [];

  const historyTokens = historyToUse.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0,
  );
  if (
    historyTokens +
      estimateTokens(fullSystemPrompt) +
      estimateTokens(currentMessageContent) >
    MAX_PROMPT_TOKENS
  ) {
    const total =
      historyTokens +
      estimateTokens(fullSystemPrompt) +
      estimateTokens(currentMessageContent);
    const excess = total - MAX_PROMPT_TOKENS;
    const avgPerMsg = historyTokens / Math.max(historyToUse.length, 1);
    const removeCount = Math.ceil(excess / Math.max(avgPerMsg, 1));
    historyToUse = historyToUse.slice(removeCount);
    console.warn(`⚠️ History gekürzt um ${removeCount} Einträge wegen Token-Limit`);
  }

  messages.push(
    ...historyToUse.map(
      (msg): PromptMessage => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }),
    ),
  );

  messages.push({ role: 'user', content: currentMessageContent });

  const totalTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0,
  );
  if (totalTokens > MAX_PROMPT_TOKENS) {
    console.warn(`⚠️ Prompt tokens estimate ${totalTokens} > ${MAX_PROMPT_TOKENS}`);
  }

  console.log(
    `📝 Prompt built: messages=${messages.length}, tokens≈${totalTokens}`,
  );
  return messages;
};

export class ConversationHistory {
  private history: ChatMessage[] = [];
  private readonly MAX_HISTORY = 100;

  private generateUniqueId(): string {
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private pushAndTrim(msg: ChatMessage) {
    this.history.push(msg);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.splice(0, this.history.length - this.MAX_HISTORY);
    }
  }

  loadFromMessages(messages: ChatMessage[]) {
    const capped = Array.isArray(messages) ? messages.slice(-this.MAX_HISTORY) : [];
    this.history = capped.map((msg) => ({
      ...msg,
      id: this.generateUniqueId(),
    }));
    if (messages.length > this.MAX_HISTORY) {
      console.warn(`🧠 History capped: ${messages.length} → ${this.MAX_HISTORY}`);
    }
    console.log(`🧠 History loaded (${this.history.length} entries)`);
  }

  addUser(message: string) {
    if (!message || typeof message !== 'string') return;
    this.pushAndTrim({
      id: this.generateUniqueId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });
  }

  addAssistant(message: string) {
    if (!message || typeof message !== 'string') return;
    try {
      if (message.startsWith('[') && message.includes('"path":')) {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].path) {
          const files = parsed.map((f: any) => normalizePath(f.path)).join(', ');
          const summary = `[Code Update: ${parsed.length} files: ${files}]`;
          this.pushAndTrim({
            id: this.generateUniqueId(),
            role: 'assistant',
            content: summary,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }
    } catch {
      // ignoriere, fallback unten
    }

    this.pushAndTrim({
      id: this.generateUniqueId(),
      role: 'assistant',
      content: message,
      timestamp: new Date().toISOString(),
    });
  }

  getHistory(): ChatMessage[] {
    return this.history;
  }

  clear() {
    this.history = [];
    console.log('🧠 History cleared');
  }
}
