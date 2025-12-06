import { AllAIProviders } from '../contexts/AIContext';
import { ProjectFile, ChatMessage } from '../contexts/types';
import { CONFIG } from '../config';
import { getCodeLineCount, ensureStringContent, normalizePath } from '../utils/chatUtils';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Basis System Prompt (Token-Saver)
const SYSTEM_PROMPT = `
Du bist k1w1, ein Experten-Builder für React Native (Expo SDK 54).
Antworte IMMER NUR mit einem validen JSON-Array von Datei-Objekten, wenn du Code schreibst.
Format: [{"path": "...", "content": "..."}]

Regeln:
1. Keine Markdown-Codeblöcke um das JSON.
2. Vollständiger Code, keine Platzhalter ("// ... rest of code").
3. Nutze 'react-native-safe-area-context', 'expo-router' oder React Navigation.
4. UI muss dunkel (Dark Mode) und stylisch sein (Neon/Cyberpunk Akzente).
5. Pfade müssen relativ zum Root sein (z.B. "components/MyComp.tsx").
`;

export const buildPrompt = (
  role: 'generator' | 'agent',
  provider: AllAIProviders,
  userMessage: string,
  files: ProjectFile[],
  history: ChatMessage[]
): PromptMessage[] => {
  
  // 1. Kontext bauen (gekürzt um Token zu sparen)
  const fileContext = files
    .filter(f => !f.path.endsWith('.lock') && !f.path.includes('assets/') && !f.path.includes('node_modules')) 
    .slice(0, 15) // Max 15 Dateien
    .map(f => `### ${f.path}\n${f.content.substring(0, 2000)}`) // Max 2000 Zeichen pro Datei
    .join('\n\n');

  const fullSystem = `${SYSTEM_PROMPT}\n\nAKTUELLE DATEIEN:\n${fileContext}`;

  // 2. History begrenzen
  const cleanHistory: PromptMessage[] = history.slice(-6).map(m => ({
    role: m.role as any,
    content: m.content.length > 1000 ? m.content.substring(0, 1000) + '...' : m.content
  }));

  return [
    { role: 'system', content: fullSystem },
    ...cleanHistory,
    { role: 'user', content: userMessage }
  ];
};
