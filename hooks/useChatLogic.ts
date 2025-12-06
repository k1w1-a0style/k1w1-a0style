// hooks/useChatLogic.ts
// Kapselt die gesamte Chat- und Builder-Logik des ChatScreens

import { useState, useCallback } from 'react';
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

export function useChatLogic() {
  const {
    projectData,
    messages,
    isLoading: isProjectLoading,
    addChatMessage,
    updateProjectFiles,
  } = useProject();

  const { config } = useAI();

  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] =
    useState<DocumentResultAsset | null>(null);

  const combinedIsLoading = isProjectLoading || isAiLoading;

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
    // Verhindert parallele Builder-Läufe, z.B. durch Enter-Tastatur während die KI arbeitet
    if (combinedIsLoading) {
      return;
    }

    if (!textInput.trim() && !selectedFileAsset) {
      return;
    }

    setError(null);

    // Projektdateien jeweils aktuell aus dem Context lesen
    const projectFiles: ProjectFile[] = projectData?.files ?? [];

    const userContent =
      textInput.trim() ||
      (selectedFileAsset
        ? `Datei gesendet: ${selectedFileAsset.name}`
        : '');

    const lower = userContent.toLowerCase();
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

    // Schnelle Meta-Commands zum Testen / Debuggen
    if (lower.includes('wie viele datei')) {
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `📂 Dein Projekt enthält aktuell ${projectFiles.length} Dateien.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (lower.includes('liste alle datei')) {
      const list = projectFiles
        .map((f) => `• ${f.path} (${f.content.length} Zeichen)`)
        .join('\n');

      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content:
          list ||
          '📂 Keine Dateien im Projekt – starte mit einem neuen Template!',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (
      lower.includes('prüfe alle datei') ||
      lower.includes('check typescript') ||
      lower.includes('tsc') ||
      lower.includes('typescript error')
    ) {
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content:
          '🧪 TypeScript-Check ist noch nicht direkt angebunden – bitte den TS-Check manuell im Terminal ausführen.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Ab hier: normaler Builder-Flow
    setIsAiLoading(true);

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

      const normalized = normalizeAiResponse(ai.text);

      if (!normalized || normalized.length === 0) {
        const msg =
          '⚠️ Die KI-Antwort konnte nicht in Dateien übersetzt werden (0 Dateien).';

        setError(msg);

        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      console.log(
        '[ChatScreen] 📦 Normalisierte Dateien:',
        normalized.length,
      );

      // === MERGE & CONTEXT-BAU ===
      const mergeResult = applyFilesToProject(projectFiles, normalized);
      await updateProjectFiles(mergeResult.files);

      const createdSet = new Set(mergeResult.created);

      const normalizedMap = new Map<string, string>();
      normalized.forEach((f: any) => {
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
  };
}
