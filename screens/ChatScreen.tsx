// screens/ChatScreen.tsx — Builder mit Rotation-Feedback
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { ChatMessage, ProjectFile } from '../contexts/types';
import MessageItem from '../components/MessageItem';
import { runOrchestrator } from '../lib/orchestrator';
import { normalizeAiResponse } from '../lib/normalizer';
import { applyFilesToProject } from '../lib/fileWriter';
import { buildBuilderMessages, LlmMessage } from '../lib/promptEngine';
import { useAI } from '../contexts/AIContext';
import { validateProjectFiles } from '../utils/chatUtils';
import { v4 as uuidv4 } from 'uuid';

type DocumentResultAsset = NonNullable<
  import('expo-document-picker').DocumentPickerResult['assets']
>[0];

const ChatScreen: React.FC = () => {
  const {
    projectData,
    messages,
    isLoading: isProjectLoading,
    addChatMessage,
    updateProjectFiles,
  } = useProject();

  const { config } = useAI();

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] =
    useState<DocumentResultAsset | null>(null);

  const combinedIsLoading = isProjectLoading || isAiLoading;
  const projectFiles: ProjectFile[] = projectData?.files ?? [];

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedFileAsset(asset);
        Alert.alert(
          'Datei ausgewählt',
          `${asset.name} (${asset.size ? (asset.size / 1024).toFixed(2) + ' KB' : '?'})`
        );
      } else {
        setSelectedFileAsset(null);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Dateiauswahl fehlgeschlagen');
      setSelectedFileAsset(null);
    }
  };

  const handleSend = async () => {
    if (!textInput.trim() && !selectedFileAsset) {
      return;
    }

    setError(null);
    const userContent =
      textInput.trim() ||
      (selectedFileAsset ? `Datei gesendet: ${selectedFileAsset.name}` : '');
    const lower = userContent.toLowerCase();

    console.log(
      '[ChatScreen] ▶️ Sende an KI:',
      userContent,
      'Provider:',
      config.selectedChatProvider,
      'Model:',
      config.selectedChatMode,
      'Quality:',
      config.qualityMode
    );

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMessage);
    setTextInput('');
    setSelectedFileAsset(null);

    // META-COMMANDS
    if (lower.includes('wie viele datei')) {
      const count = projectFiles.length;
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `📊 Aktuell sind ${count} Datei(en) im Projekt gespeichert.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (lower.includes('liste alle datei')) {
      if (projectFiles.length === 0) {
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: '📂 Es sind noch keine Projektdateien vorhanden.',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const lines = projectFiles.map((f) => `• ${f.path}`).join('\n');
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `📂 Aktuelle Projektdateien (${projectFiles.length}):\n\n${lines}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (lower.includes('prüfe alle datei')) {
      if (projectFiles.length === 0) {
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: '⚠️ Es gibt keine Dateien zum Prüfen.',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const validation = validateProjectFiles(projectFiles);
      if (validation.valid) {
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: `✅ Projektprüfung: Keine kritischen Probleme (${projectFiles.length} Dateien).`,
          timestamp: new Date().toISOString(),
        });
      } else {
        const shown = validation.errors.slice(0, 15);
        const rest = validation.errors.length - shown.length;
        const errorText =
          shown.map((e) => `• ${e}`).join('\n') +
          (rest > 0 ? `\n… und ${rest} weitere Meldung(en).` : '');
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: `⚠️ Projektprüfung: ${validation.errors.length} Problem(e):\n\n${errorText}`,
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }

    if (lower.includes('erstelle alle fehlenden datei')) {
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content:
          'ℹ️ Der Builder kann nicht automatisch erkennen, welche Dateien "fehlen". Beschreibe bitte konkret, welche Screens/Komponenten du brauchst.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // KI-Flow
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
        projectFiles
      );

      console.log(
        '[ChatScreen] 🧠 LLM-Messages vorbereitet, Länge:',
        llmMessages.length
      );

      const ai = await runOrchestrator(
        config.selectedChatProvider,
        config.selectedChatMode,
        config.qualityMode,
        llmMessages as any[]
      );

      console.log('[ChatScreen] 🤖 Orchestrator Ergebnis:', ai);

      if (!ai || !ai.ok) {
        const msg =
          '⚠️ Die KI konnte keinen gültigen Output liefern (kein ok=true).';
        setError(msg);
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        setIsAiLoading(false);
        return;
      }

      if (!ai.text && !ai.files) {
        const msg = '⚠️ Die KI-Antwort war leer oder ohne Dateien.';
        setError(msg);
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        setIsAiLoading(false);
        return;
      }

      console.log(
        '[ChatScreen] 📄 Rohe KI-Antwort-Länge:',
        (ai.text || '').length
      );

      const rawForNormalizer =
        ai.files && Array.isArray(ai.files)
          ? ai.files
          : ai.text
          ? ai.text
          : ai.raw;

      const normalized = normalizeAiResponse(rawForNormalizer);

      if (!normalized) {
        const msg =
          '⚠️ Normalizer/Validator konnte die Dateien nicht verarbeiten.';
        setError(msg);
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        setIsAiLoading(false);
        return;
      }

      console.log('[ChatScreen] 📦 Normalisierte Dateien:', normalized.length);

      const mergeResult = applyFilesToProject(projectFiles, normalized);
      await updateProjectFiles(mergeResult.files);

      const summaryText =
        `✅ KI-Update erfolgreich (Provider: ${ai.provider || 'unbekannt'})\n` +
        `📝 Neue Dateien: ${mergeResult.created.length}\n` +
        `📝 Geänderte Dateien: ${mergeResult.updated.length}\n` +
        `⏭ Übersprungen: ${mergeResult.skipped.length}`;

      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: summaryText,
        timestamp: new Date().toISOString(),
        meta: {
          provider: ai.provider,
        },
      });

      // ✅ Rotation Feedback
      if (ai.keysRotated && ai.keysRotated > 0) {
        addChatMessage({
          id: uuidv4(),
          role: 'system',
          content: `🔄 API-Key wurde ${ai.keysRotated}x automatisch rotiert (Rate Limit erreicht)`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      const msg =
        '⚠️ Es ist ein Fehler im Builder-Flow aufgetreten. Siehe Konsole.';
      console.log('[ChatScreen] ⚠️ Fehler:', e?.message || e);
      setError(msg);
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: msg,
        timestamp: new Date().toISOString(),
        meta: {
          error: true,
        },
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <MessageItem message={item} />
  );

  const renderFooter = () => {
    if (!isAiLoading) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={theme.palette.primary} />
        <Text style={styles.loadingText}>KI denkt nach…</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <View style={styles.container}>
        <View style={styles.listContainer}>
          {combinedIsLoading && messages.length === 0 ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.palette.primary} />
              <Text style={styles.loadingText}>Lade Projekt / KI…</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={renderFooter}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{String(error)}</Text>
          </View>
        )}

        <View style={styles.inputWrapper}>
          {selectedFileAsset && (
            <View style={styles.attachedFileContainer}>
              <Ionicons
                name="document-attach-outline"
                size={14}
                color={theme.palette.text.secondary}
              />
              <Text style={styles.attachedFileText} numberOfLines={1}>
                {selectedFileAsset.name}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedFileAsset(null)}
                style={styles.removeFileButton}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.palette.text.secondary}
                />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainerInner}>
            <TouchableOpacity
              onPress={handlePickDocument}
              style={styles.iconButton}
              disabled={combinedIsLoading}
            >
              <Ionicons
                name="document-attach-outline"
                size={22}
                color={theme.palette.text.secondary}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Beschreibe, was der Builder tun soll…"
              placeholderTextColor={theme.palette.input.placeholder}
              editable={!combinedIsLoading}
              multiline
            />

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={combinedIsLoading}
            >
              {isAiLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingFooter: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: theme.palette.card,
  },
  inputContainerInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.palette.input.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  iconButton: {
    padding: 4,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    color: theme.palette.text.primary,
    maxHeight: 120,
    minHeight: 36,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  sendButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: theme.palette.primary,
    marginLeft: 4,
  },
  attachedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.input.background + '60',
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginHorizontal: 6,
    marginBottom: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  attachedFileText: {
    flex: 1,
    marginLeft: 6,
    marginRight: 4,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  removeFileButton: {
    padding: 2,
  },
  errorContainer: {
    marginTop: 4,
    marginHorizontal: 6,
    borderRadius: 6,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.error,
    padding: 6,
  },
  errorText: {
    color: theme.palette.error,
    textAlign: 'center',
    fontSize: 12,
  },
});

export default ChatScreen;
