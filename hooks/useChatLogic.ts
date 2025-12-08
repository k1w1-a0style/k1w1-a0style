// hooks/useChatLogic.ts
// Kapselt die gesamte Chat- und Builder-Logik des ChatScreens

import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { v4 as uuidv4 } from 'uuid';

import { useProject } from '../contexts/ProjectContext';
import { useAI } from '../contexts/AIContext';
import {
  ChatMessage,
  ProjectFile,
  BuilderContextData,
} from '../contexts/types';
import { runOrchestrator } from '../lib/orchestrator';
import { normalizeAiResponse } from '../lib/normalizer';
import { applyFilesToProject } from '../lib/fileWriter';
import { buildBuilderMessages, LlmMessage } from '../lib/promptEngine';
import { validateProjectFiles } from '../utils/chatUtils';

type DocumentResultAsset = NonNullable<
  DocumentPicker.DocumentPickerResult['assets']
>[0];

// Meta-Commands für schnelle Aktionen
interface MetaCommand {
  patterns: RegExp[];
  handler: (projectFiles: ProjectFile[], match: RegExpMatchArray | null) => string;
}

const META_COMMANDS: MetaCommand[] = [
  {
    patterns: [/wie\s*viele?\s*datei/i, /anzahl\s*(der\s*)?datei/i, /datei.*anzahl/i],
    handler: (files) => `📂 Dein Projekt enthält aktuell ${files.length} Dateien.`,
  },
  {
    patterns: [/liste?\s*(alle\s*)?datei/i, /zeig.*datei/i, /datei.*liste/i, /welche\s*datei/i],
    handler: (files) => {
      if (files.length === 0) {
        return '📂 Keine Dateien im Projekt – starte mit einem neuen Template!';
      }
      const list = files
        .slice(0, 30)
        .map((f) => `• ${f.path} (${f.content.length} Zeichen)`)
        .join('\n');
      const suffix = files.length > 30 ? `\n\n... und ${files.length - 30} weitere Dateien` : '';
      return `📂 Projektdateien:\n${list}${suffix}`;
    },
  },
  {
    patterns: [/projekt.*name/i, /wie\s*heißt.*projekt/i, /name.*projekt/i],
    handler: () => '💡 Um den Projektnamen zu ändern, gehe zu Einstellungen > Projekt.',
  },
  {
    patterns: [/typescript.*check/i, /tsc\b/i, /prüfe.*code/i, /lint/i],
    handler: () =>
      '🧪 TypeScript-/Lint-Check ist noch nicht direkt angebunden – nutze den Code-Screen für Syntax-Highlighting.',
  },
  {
    patterns: [/hilfe|help|was kannst du/i],
    handler: () =>
      '🤖 Ich bin der k1w1 Builder! Du kannst mir sagen:\n' +
      '• "Erstelle einen Login-Screen"\n' +
      '• "Füge einen Dark Mode Toggle hinzu"\n' +
      '• "Wie viele Dateien hat mein Projekt?"\n' +
      '• "Liste alle Dateien"\n\n' +
      'Beschreibe einfach, was du bauen möchtest!',
  },
];

/** Prüft ob ein Text einem Meta-Command entspricht */
const matchMetaCommand = (text: string): { command: MetaCommand; match: RegExpMatchArray } | null => {
  const lower = text.toLowerCase().trim();
  for (const cmd of META_COMMANDS) {
    for (const pattern of cmd.patterns) {
      const match = lower.match(pattern);
      if (match) return { command: cmd, match };
    }
  }
  return null;
};

export function useChatLogic() {
  const {
    projectData,
    messages,
    isLoading: isProjectLoading,
    addChatMessage,
    updateProjectFiles,
  } = useProject();

  const { config, isReady: isAiReady } = useAI();

  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] =
    useState<DocumentResultAsset | null>(null);

  // AbortController für Request-Cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  const combinedIsLoading = isProjectLoading || isAiLoading || !isAiReady;

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /** Bricht den aktuellen AI-Request ab */
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsAiLoading(false);
      setError('Request abgebrochen');
      
      addChatMessage({
        id: uuidv4(),
        role: 'system',
        content: '⏹️ Request wurde abgebrochen.',
        timestamp: new Date().toISOString(),
      });
    }
  }, [addChatMessage]);

  /** Löscht den aktuellen Fehler */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedFileAsset(asset);

        Alert.alert(
          '✅ Datei ausgewählt',
          `${asset.name} (${
            asset.size ? (asset.size / 1024).toFixed(2) + ' KB' : '?'
          })`,
        );
      } else {
        setSelectedFileAsset(null);
      }
    } catch (e) {
      console.error('Fehler beim Auswählen der Datei', e);
      Alert.alert('Fehler', 'Dateiauswahl fehlgeschlagen');
    }
  }, []);

  const handleSend = useCallback(async () => {
    // Verhindert parallele Builder-Läufe
    if (combinedIsLoading) {
      return;
    }

    if (!isAiReady) {
      setError('⚙️ KI-Konfiguration wird noch geladen. Bitte einen Moment warten.');
      return;
    }

    if (!textInput.trim() && !selectedFileAsset) {
      return;
    }

    // Error beim Senden löschen
    setError(null);

    // Projektdateien jeweils aktuell aus dem Context lesen
    const projectFiles: ProjectFile[] = projectData?.files ?? [];

    const userContent =
      textInput.trim() ||
      (selectedFileAsset
        ? `Datei gesendet: ${selectedFileAsset.name}`
        : '');

    console.log('[ChatScreen] ▶️ Sende an KI:', userContent);

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    };

    // Direkt in den Chat übernehmen
    addChatMessage(userMessage);
    setTextInput('');
    setSelectedFileAsset(null);

    // Meta-Commands prüfen (schnelle lokale Aktionen)
    const metaMatch = matchMetaCommand(userContent);
    if (metaMatch) {
      const response = metaMatch.command.handler(projectFiles, metaMatch.match);
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Ab hier: normaler Builder-Flow
    setIsAiLoading(true);

    // Neuen AbortController erstellen
    abortControllerRef.current = new AbortController();

    try {
      const historyWithCurrent = [...messages, userMessage];
      const historyAsLlm: LlmMessage[] = historyWithCurrent.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const llmMessages = buildBuilderMessages(
        historyAsLlm,
        userContent,
        projectFiles,
      );

      console.log(
        '[ChatScreen] 🧠 LLM-Messages vorbereitet, Länge:',
        llmMessages.length,
      );

      const ai = await runOrchestrator(
        config.selectedChatProvider,
        config.selectedChatMode,
        config.qualityMode,
        llmMessages,
      );

      console.log('[ChatScreen] 🤖 Orchestrator Ergebnis:', ai);

      if (!ai || !ai.ok) {
        const msg =
          '⚠️ Die KI konnte keinen gültigen Output liefern (kein ok=true).';

        setError(msg);

        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content:
            msg +
            '\n\nDetails:\n' +
            (ai?.error ||
              'Unbekannter Fehler – bitte Logs prüfen oder erneut versuchen.'),
          timestamp: new Date().toISOString(),
        });

        return;
      }

      const normalization = normalizeAiResponse(ai.text);

      if (!normalization.ok) {
        const details = normalization.errors ?? [];
        const msg =
          '⚠️ Die KI-Antwort konnte nicht in gültige Dateien übersetzt werden.' +
          (details.length ? `\n\n${details.join('\n')}` : '');

        setError(msg);

        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (normalization.files.length === 0) {
        const msg =
          '⚠️ Die KI-Antwort hat keine Dateien zurückgegeben.';

        setError(msg);
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const normalized = normalization.files;

      console.log(
        '[ChatScreen] 📦 Normalisierte Dateien:',
        normalized.length,
      );

      // === MERGE & CONTEXT-BAU ===
      const mergeResult = applyFilesToProject(projectFiles, normalized);
      await updateProjectFiles(mergeResult.files);

      const createdSet = new Set(mergeResult.created);

      const normalizedMap = new Map<string, string>();
      normalized.forEach((f) => {
        if (f?.path) {
          normalizedMap.set(f.path, String(f.content ?? ''));
        }
      });

      const filesChanged: BuilderContextData['filesChanged'] = [];
      const allChangedPaths = new Set<string>([
        ...mergeResult.created,
        ...mergeResult.updated,
      ]);

      allChangedPaths.forEach((path) => {
        const type: 'created' | 'updated' = createdSet.has(path)
          ? 'created'
          : 'updated';
        const content = normalizedMap.get(path) ?? '';

        const preview = content;

        filesChanged.push({
          path,
          type,
          preview,
        });
      });

      const totalLines =
        filesChanged.reduce((sum, f) => {
          if (!f.preview) return sum;
          return sum + f.preview.split('\n').length;
        }, 0) ?? 0;

      const timing =
        ai.timing && ai.timing.durationMs
          ? ` (${(ai.timing.durationMs / 1000).toFixed(1)}s)`
          : '';

      const summaryText =
        `✅ KI-Update erfolgreich${timing}\n\n` +
        `🤖 Provider: ${ai.provider || 'unbekannt'}${
          ai.keysRotated ? ` (${ai.keysRotated}x rotiert)` : ''
        }\n` +
        `📄 Neue Dateien: ${mergeResult.created.length}\n` +
        `📄 Geänderte Dateien: ${mergeResult.updated.length}\n` +
        `⏭ Übersprungen: ${mergeResult.skipped.length}`;

      const context: BuilderContextData = {
        provider: ai.provider || 'unbekannt',
        model: (ai as any).model || 'unbekannt',
        duration: ai.timing?.durationMs,
        filesChanged,
        totalLines,
        keysRotated: ai.keysRotated,
        summary: summaryText,
        quality: config.qualityMode,
        messageCount: llmMessages.length,
      };

      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: summaryText,
        timestamp: new Date().toISOString(),
        meta: {
          provider: ai.provider,
          context,
        },
      } as any);

      if (ai.keysRotated && ai.keysRotated > 0) {
        addChatMessage({
          id: uuidv4(),
          role: 'system',
          content: `🔄 API-Key wurde ${ai.keysRotated}x automatisch rotiert (Rate Limit erreicht)`,
          timestamp: new Date().toISOString(),
        });
      }

      // Optional: Projekt grob validieren
      const validation = validateProjectFiles(mergeResult.files);

      if (!validation.valid) {
        addChatMessage({
          id: uuidv4(),
          role: 'system',
          content:
            '⚠️ Projekt-Validierung meldet potenzielle Probleme:\n' +
            validation.errors.join('\n'),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.error('[ChatScreen] Fehler im Builder-Flow', e);

      const msg =
        e?.message ||
        '❌ Unerwarteter Fehler im Builder – bitte Logs im Terminal prüfen.';

      setError(msg);

      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: msg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsAiLoading(false);
    }
  }, [
    addChatMessage,
    combinedIsLoading,
    config,
    messages,
    projectData,
    selectedFileAsset,
    textInput,
    updateProjectFiles,
  ]);

  return {
    messages,
    textInput,
    setTextInput,
    selectedFileAsset,
    setSelectedFileAsset,
    handlePickDocument,
    handleSend,
    combinedIsLoading,
    error,
    clearError,
    cancelRequest,
    isAiLoading,
  };
}
