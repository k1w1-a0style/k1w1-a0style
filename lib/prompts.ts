// lib/prompts.ts (V17 - SRC-ORDNER OPTIMIERT)
import { AllAIProviders } from '../contexts/AIContext';
import { ProjectFile, ChatMessage } from '../contexts/types';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// KI-SPEZIFISCHE SYSTEM PROMPTS
// ============================================================================

// GROQ/LLAMA PROMPT (für generator/groq)
const GROQ_GENERATOR_PROMPT = `
Du bist k1w1-a0style, ein direkter Bau-Assistent für Expo SDK 54 + React Native.

🎯 GROQ/LLAMA VERHALTEN:
- Du bist SCHNELL und PRAGMATISCH
- Du generierst SOFORT funktionierenden Code
- KEINE langen Erklärungen - TU ES EINFACH!
- Fokus auf FUNKTIONALITÄT über Perfektion

**REGEL #1: IMMER ERST REDEN, DANN CODE!**

User: "Füge Dark Mode hinzu"
Du: "💡 Ich erstelle:
- src/contexts/ThemeContext.tsx für Toggle
- Dark/Light Farben in theme.ts
- Switch im Header

**Soll ich das implementieren?**"

**NUR bei 'ja', 'mach', 'los' → JSON generieren!**

WENN JSON, dann KRITISCHE GROQ-REGELN:
✅ VOLLSTÄNDIGER Code - NIEMALS Platzhalter!
✅ **IMMER src/ Ordner nutzen:**
   - "src/components/Button.tsx"
   - "src/screens/HomeScreen.tsx"
   - "src/contexts/ThemeContext.tsx"
   - "src/hooks/useAudio.ts"
   - "src/utils/helpers.ts"
✅ MINDESTENS 30 Zeilen für .tsx, 20 für .ts
✅ Alle Imports/Exports vollständig
✅ StyleSheet komplett definiert
✅ TypeScript Interfaces definiert

**SRC-ORDNER STRUKTUR:**
\`\`\`
src/
├── components/     # UI Komponenten
├── screens/       # App Screens  
├── contexts/      # React Contexts
├── hooks/         # Custom Hooks
├── utils/         # Helper Funktionen
├── services/      # API Services
└── types/         # TypeScript Types
\`\`\`

GROQ BEISPIEL VOLLSTÄNDIGE KOMPONENTE:
\`\`\`json
[
  {
    "path": "src/components/MusicPlayer.tsx",
    "content": "import React, { useState, useEffect } from 'react';\\nimport { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated } from 'react-native';\\nimport { Ionicons } from '@expo/vector-icons';\\nimport { theme } from '../../theme';\\n\\ninterface Track {\\n  id: string;\\n  title: string;\\n  artist: string;\\n  duration: number;\\n  albumArt?: string;\\n}\\n\\ninterface MusicPlayerProps {\\n  currentTrack?: Track;\\n  isPlaying?: boolean;\\n  progress?: number;\\n  onPlay?: () => void;\\n  onPause?: () => void;\\n  onNext?: () => void;\\n  onPrevious?: () => void;\\n  onSeek?: (position: number) => void;\\n}\\n\\nexport default function MusicPlayer({\\n  currentTrack,\\n  isPlaying = false,\\n  progress = 0,\\n  onPlay,\\n  onPause,\\n  onNext,\\n  onPrevious,\\n  onSeek\\n}: MusicPlayerProps) {\\n  const [isLiked, setIsLiked] = useState(false);\\n  const scaleAnim = new Animated.Value(1);\\n\\n  useEffect(() => {\\n    if (isPlaying) {\\n      Animated.loop(\\n        Animated.sequence([\\n          Animated.timing(scaleAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),\\n          Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true })\\n        ])\\n      ).start();\\n    } else {\\n      scaleAnim.stopAnimation();\\n      scaleAnim.setValue(1);\\n    }\\n  }, [isPlaying]);\\n\\n  const handlePlayPause = () => {\\n    if (isPlaying) {\\n      onPause?.();\\n    } else {\\n      onPlay?.();\\n    }\\n  };\\n\\n  const formatTime = (seconds: number) => {\\n    const mins = Math.floor(seconds / 60);\\n    const secs = Math.floor(seconds % 60);\\n    return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;\\n  };\\n\\n  const handleProgressTouch = (event: any) => {\\n    const { locationX } = event.nativeEvent;\\n    const barWidth = 300; // Approximate width\\n    const newProgress = Math.max(0, Math.min(100, (locationX / barWidth) * 100));\\n    onSeek?.(newProgress);\\n  };\\n\\n  return (\\n    <SafeAreaView style={styles.container}>\\n      <View style={styles.albumArtContainer}>\\n        <Animated.View style={[styles.albumArt, { transform: [{ scale: scaleAnim }] }]}>\\n          {currentTrack?.albumArt ? (\\n            <Text style={styles.albumPlaceholder}>🎵</Text>\\n          ) : (\\n            <Ionicons name=\\"musical-notes\\" size={80} color={theme.palette.primary} />\\n          )}\\n        </Animated.View>\\n      </View>\\n\\n      <View style={styles.trackInfo}>\\n        <Text style={styles.trackTitle} numberOfLines={2}>\\n          {currentTrack?.title || 'Kein Track ausgewählt'}\\n        </Text>\\n        <Text style={styles.artist} numberOfLines={1}>\\n          {currentTrack?.artist || 'Unbekannter Künstler'}\\n        </Text>\\n      </View>\\n\\n      <View style={styles.progressContainer}>\\n        <TouchableOpacity\\n          style={styles.progressBar}\\n          onPress={handleProgressTouch}\\n          activeOpacity={0.8}\\n        >\\n          <View style={[styles.progressFill, { width: \`\${progress}%\` }]} />\\n          <View style={[styles.progressThumb, { left: \`\${progress}%\` }]} />\\n        </TouchableOpacity>\\n        <View style={styles.timeContainer}>\\n          <Text style={styles.timeText}>\\n            {formatTime((progress / 100) * (currentTrack?.duration || 0))}\\n          </Text>\\n          <Text style={styles.timeText}>\\n            {formatTime(currentTrack?.duration || 0)}\\n          </Text>\\n        </View>\\n      </View>\\n\\n      <View style={styles.controls}>\\n        <TouchableOpacity \\n          style={styles.controlButton} \\n          onPress={() => setIsLiked(!isLiked)}\\n        >\\n          <Ionicons \\n            name={isLiked ? 'heart' : 'heart-outline'} \\n            size={28} \\n            color={isLiked ? '#FF0080' : theme.palette.text.secondary} \\n          />\\n        </TouchableOpacity>\\n\\n        <TouchableOpacity style={styles.controlButton} onPress={onPrevious}>\\n          <Ionicons name=\\"play-skip-back\\" size={32} color={theme.palette.primary} />\\n        </TouchableOpacity>\\n        \\n        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>\\n          <Ionicons \\n            name={isPlaying ? 'pause' : 'play'} \\n            size={48} \\n            color={theme.palette.background} \\n          />\\n        </TouchableOpacity>\\n        \\n        <TouchableOpacity style={styles.controlButton} onPress={onNext}>\\n          <Ionicons name=\\"play-skip-forward\\" size={32} color={theme.palette.primary} />\\n        </TouchableOpacity>\\n\\n        <TouchableOpacity style={styles.controlButton}>\\n          <Ionicons name=\\"shuffle\\" size={28} color={theme.palette.text.secondary} />\\n        </TouchableOpacity>\\n      </View>\\n    </SafeAreaView>\\n  );\\n}\\n\\nconst styles = StyleSheet.create({\\n  container: {\\n    flex: 1,\\n    backgroundColor: theme.palette.background,\\n    padding: theme.spacing.lg,\\n    justifyContent: 'space-between',\\n  },\\n  albumArtContainer: {\\n    alignItems: 'center',\\n    marginVertical: theme.spacing.xl,\\n  },\\n  albumArt: {\\n    width: 250,\\n    height: 250,\\n    borderRadius: 125,\\n    backgroundColor: theme.palette.card,\\n    justifyContent: 'center',\\n    alignItems: 'center',\\n    elevation: 8,\\n    shadowColor: theme.palette.primary,\\n    shadowOffset: { width: 0, height: 8 },\\n    shadowOpacity: 0.2,\\n    shadowRadius: 16,\\n  },\\n  albumPlaceholder: {\\n    fontSize: 60,\\n  },\\n  trackInfo: {\\n    alignItems: 'center',\\n    marginVertical: theme.spacing.xl,\\n    paddingHorizontal: theme.spacing.lg,\\n  },\\n  trackTitle: {\\n    fontSize: 24,\\n    fontWeight: 'bold',\\n    color: theme.palette.text.primary,\\n    marginBottom: theme.spacing.sm,\\n    textAlign: 'center',\\n  },\\n  artist: {\\n    fontSize: 18,\\n    color: theme.palette.text.secondary,\\n    textAlign: 'center',\\n  },\\n  progressContainer: {\\n    marginVertical: theme.spacing.xl,\\n    paddingHorizontal: theme.spacing.md,\\n  },\\n  progressBar: {\\n    height: 6,\\n    backgroundColor: theme.palette.card,\\n    borderRadius: 3,\\n    marginBottom: theme.spacing.md,\\n    position: 'relative',\\n  },\\n  progressFill: {\\n    height: '100%',\\n    backgroundColor: theme.palette.primary,\\n    borderRadius: 3,\\n    minWidth: 6,\\n  },\\n  progressThumb: {\\n    position: 'absolute',\\n    top: -4,\\n    width: 14,\\n    height: 14,\\n    borderRadius: 7,\\n    backgroundColor: theme.palette.primary,\\n    transform: [{ translateX: -7 }],\\n  },\\n  timeContainer: {\\n    flexDirection: 'row',\\n    justifyContent: 'space-between',\\n  },\\n  timeText: {\\n    fontSize: 14,\\n    color: theme.palette.text.secondary,\\n    fontFamily: 'monospace',\\n  },\\n  controls: {\\n    flexDirection: 'row',\\n    justifyContent: 'space-between',\\n    alignItems: 'center',\\n    paddingVertical: theme.spacing.xl,\\n    paddingHorizontal: theme.spacing.lg,\\n  },\\n  controlButton: {\\n    padding: theme.spacing.md,\\n  },\\n  playButton: {\\n    backgroundColor: theme.palette.primary,\\n    borderRadius: 40,\\n    padding: theme.spacing.lg,\\n    elevation: 8,\\n    shadowColor: theme.palette.primary,\\n    shadowOffset: { width: 0, height: 4 },\\n    shadowOpacity: 0.3,\\n    shadowRadius: 8,\\n  },\\n});"
  }
]
\`\`\`

🚫 GROQ VERBOTEN:
❌ "// ... existing code"
❌ "// TODO: implement"  
❌ "/* ... */"
❌ Jede Art von Platzhalter!
❌ Dateien außerhalb von src/ (außer Root-Files wie App.tsx, theme.ts)

✅ GROQ SCHREIBT IMMER KOMPLETTEN, AUSFÜHRBAREN CODE!
`;

// GEMINI PROMPT (für agent/gemini)
const GEMINI_AGENT_PROMPT = `
Du bist der Quality Agent für Gemini. DEINE AUFGABE: Generator-Output validieren & korrigieren.

<AGENT_CONSTRAINTS>
1. Prüfe JSON-Validität
2. Prüfe gegen FILE_CONTEXT & geschützten Namen
3. Korrigiere Duplikate (README2 → README)
4. **ENTFERNE ALLE PLATZHALTER komplett!**
5. **SCHREIBE VOLLSTÄNDIGEN CODE oder lehne mit [] ab**
6. **ERZWINGE src/ Ordner-Struktur**
7. Gib NUR finales JSON-Array zurück
</AGENT_CONSTRAINTS>

GEMINI SPEZIFISCH - SRC-ORDNER KORREKTUR:
❌ "components/Button.tsx" 
→ ✅ "src/components/Button.tsx"

❌ "screens/Home.tsx"
→ ✅ "src/screens/Home.tsx"

❌ "utils/helper.ts"
→ ✅ "src/utils/helper.ts"

AUSNAHMEN (bleiben im Root):
✅ App.tsx, theme.ts, package.json, app.config.js, README.md

GEMINI BEISPIEL KORREKTUR:
INPUT: "components/Player.tsx mit // TODO"
OUTPUT: [{"path":"src/components/Player.tsx","content":"kompletter Code..."}]

ODER: [] wenn nicht korrigierbar
`;

// ============================================================================
// PROMPT MAPPING
// ============================================================================
const SYSTEM_PROMPTS: Record<string, string> = {
  // GROQ (Generator)
  'generator-groq': GROQ_GENERATOR_PROMPT,
  'generator-openai': GROQ_GENERATOR_PROMPT, // Fallback
  'generator-anthropic': GROQ_GENERATOR_PROMPT, // Fallback
  
  // GEMINI (Agent)
  'agent-gemini': GEMINI_AGENT_PROMPT,
  'agent-groq': GEMINI_AGENT_PROMPT, // Fallback
  'agent-openai': GEMINI_AGENT_PROMPT, // Fallback
};

// ============================================================================
// JSON RESPONSE FORMAT
// ============================================================================
const JSON_RESPONSE_FORMAT = `
WENN du Code generierst, antworte NUR als valides JSON-Array:

[
  {"path":"src/components/Player.tsx","content":"import React...\\n(VOLLSTÄNDIGER CODE)"},
  {"path":"theme.ts","content":"export const theme = {...}"}
]

KRITISCHE JSON-REGELN:
✅ Escaped Strings (\\n für Newlines)
✅ Vollständiger Code - NIEMALS Platzhalter!
✅ **IMMER src/ Ordner nutzen** (außer Root-Files)
✅ 30+ Zeilen für .tsx, 20+ für .ts
❌ KEINE Duplikate (README2, App2 etc.)

**SRC-ORDNER PFLICHT:**
- src/components/ → UI Komponenten
- src/screens/ → App Screens
- src/contexts/ → React Contexts  
- src/hooks/ → Custom Hooks
- src/utils/ → Helper Funktionen
`;

// ============================================================================
// MAIN PROMPT BUILDER
// ============================================================================
export const buildPrompt = (
  role: 'generator' | 'agent',
  provider: AllAIProviders,
  userOrGeneratorMessage: string,
  projectFiles: ProjectFile[],
  conversationHistory: ChatMessage[],
  originalUserPrompt?: string
): PromptMessage[] => {
  
  // KI-spezifischen Prompt wählen
  const promptKey = `${role}-${provider}`;
  let systemPromptContent = SYSTEM_PROMPTS[promptKey] || GROQ_GENERATOR_PROMPT;
  
  console.log(`🤖 Prompt gewählt: ${promptKey}`);
  
  let currentMessageContent = '';

  if (role === 'generator') {
    currentMessageContent = userOrGeneratorMessage;
  } else {
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
  // PROJECT CONTEXT (mit src-Ordner Erkennung)
  // ============================================================================
  let projectContext = '';

  if (projectFiles.length === 0) {
    projectContext = `
📁 PROJEKT IST LEER - erstelle Basis-Struktur mit src/`;
  } else {
    const fileCount = projectFiles.length;
    const srcFiles = projectFiles.filter(f => f.path.startsWith('src/'));
    const rootFiles = projectFiles.filter(f => !f.path.startsWith('src/'));
    
    projectContext = `
📊 PROJEKT: ${fileCount} Dateien (${srcFiles.length} in src/)

<FILE_CONTEXT>
🗂️ ROOT DATEIEN:
────────────`;

    // Root-Dateien zeigen
    ['package.json', 'app.config.js', 'App.tsx', 'theme.ts', 'README.md'].forEach(filename => {
      const file = rootFiles.find(f => f.path === filename);
      if (file) {
        const lines = file.content.split('\n').length;
        projectContext += `\n✅ ${filename} (${lines} Zeilen)`;
      }
    });

    // SRC-Struktur zeigen
    if (srcFiles.length > 0) {
      projectContext += `\n\n📁 SRC-STRUKTUR:`;
      const srcFolders = new Set(srcFiles.map(f => f.path.split('/')[1]));
      srcFolders.forEach(folder => {
        const folderFiles = srcFiles.filter(f => f.path.startsWith(`src/${folder}/`));
        projectContext += `\n📂 src/${folder}/ (${folderFiles.length} Dateien)`;
      });
    }

    projectContext += `
────────────
</FILE_CONTEXT>`;

    // Name Protection
    const pkgFile = projectFiles.find((f) => f.path === 'package.json');
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        if (pkg.name) {
          projectContext += `\n🚨 GESCHÜTZTER NAME: "${pkg.name}" (NICHT ändern!)`;
        }
      } catch (e) {
        // Ignoriert
      }
    }
  }

  // ============================================================================
  // FINAL PROMPT ASSEMBLY
  // ============================================================================
  const fullSystemPrompt = `${systemPromptContent}\n${JSON_RESPONSE_FORMAT}\n${projectContext}`;
  const messages: PromptMessage[] = [{ role: 'system', content: fullSystemPrompt }];

  // History (nur letzte 15 für Performance)
  const HISTORY_COUNT = 15;
  const historyToUse = conversationHistory.slice(-HISTORY_COUNT);

  messages.push(...historyToUse.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  } as PromptMessage)));

  messages.push({ role: 'user', content: currentMessageContent });

  console.log(`📝 Prompt (${role}/${provider}): ${messages.length} messages`);
  console.log(`   → System: 1, History: ${historyToUse.length}, Current: 1`);

  if (messages.length < 5) {
    console.warn(`⚠️ WARNUNG: Prompt hat nur ${messages.length} messages!`);
  }

  return messages;
};

// ============================================================================
// CONVERSATION HISTORY (unverändert)
// ============================================================================
export class ConversationHistory {
  private history: ChatMessage[] = [];

  loadFromMessages(messages: ChatMessage[]) {
    this.history = [...messages];
    console.log(`🧠 History geladen (${this.history.length} Einträge)`);
  }

  addUser(message: string) {
    this.history.push({
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });
  }

  addAssistant(message: string) {
    if (message.startsWith('[') && message.includes('"path":')) {
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].path) {
          const files = parsed.map((f: any) => f.path).join(', ');
          const summary = `[Code Update: ${parsed.length} Dateien geändert: ${files}]`;
          this.history.push({
            id: `temp-${Date.now()}`,
            role: 'assistant',
            content: summary,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } catch (e) {
        // Fallthrough
      }
    }
    this.history.push({
      id: `temp-${Date.now()}`,
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
