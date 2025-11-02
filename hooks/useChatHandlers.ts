

import { useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAI, CHAT_PROVIDER, AGENT_PROVIDER, AllAIProviders } from '../contexts/AIContext';
import { useTerminal } from '../contexts/TerminalContext';
import { useProject, ChatMessage } from '../contexts/ProjectContext';
import { buildPrompt, ConversationHistory, PromptMessage } from '../lib/prompts';
import { extractJsonArray, tryParseJsonWithRepair } from '../utils/chatUtils';
// KORREKTUR: Verwende react-native-uuid, da 'uuid' in RN Probleme machen kann
import uuid from 'react-native-uuid';

// Typ-Definition für das DocumentPicker-Asset
type DocumentResultAsset = NonNullable<import('expo-document-picker').DocumentPickerResult['assets']>[0];

// 3 Versuche für JSON-Parsing und API-Fehler
const MAX_JSON_RETRIES = 3;
const MAX_API_RETRIES = 3;

export const useChatHandlers = (
  supabase: SupabaseClient | null,
  textInput: string,
  setTextInput: (value: string) => void,
  selectedFileAsset: DocumentResultAsset | null,
  setSelectedFileAsset: (asset: DocumentResultAsset | null) => void,
  setIsAiLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) => {
  const { projectData, updateProjectFiles, messages, updateMessages } = useProject();
  const { config, getCurrentApiKey, rotateApiKey } = useAI();
  const { addLog } = useTerminal();
  const historyRef = useRef(new ConversationHistory());

  // KORREKTUR: Diese Funktion wird jetzt intern vom Hook aufgerufen
  const loadHistoryFromMessages = useCallback(() => {
    historyRef.current.loadFromMessages(messages);
  }, [messages]);

  // KORREKTUR: useEffect, um die History bei jedem Neuladen oder Nachrichten-Update zu synchronisieren
  useEffect(() => {
    if (messages.length > 0) {
      loadHistoryFromMessages();
      addLog(`🧠 History neu geladen (${historyRef.current.getHistory().length} Einträge)`);
    }
  }, [messages, loadHistoryFromMessages, addLog]); // Abhängig von 'messages'

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedFileAsset(asset);
        Alert.alert('Datei ausgewählt', `${asset.name} (${asset.size ? (asset.size / 1024).toFixed(2) + 'KB' : '?'})`);
      } else {
        setSelectedFileAsset(null);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Dateiauswahl fehlgeschlagen');
      setSelectedFileAsset(null);
    }
  };

  const callProviderWithRetry = async (
    provider: AllAIProviders,
    promptMessages: PromptMessage[],
    model: string,
    maxRetries = MAX_API_RETRIES
  ): Promise<any> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = getCurrentApiKey(provider);
      if (!apiKey) {
        throw new Error(`Keine API Keys für ${provider} verfügbar`);
      }
      try {
        addLog(`📞 API Call: ${provider} (Versuch ${attempt + 1}/${maxRetries})`);
        const { data, error } = await supabase.functions.invoke('k1w1-handler', {
          body: { messages: promptMessages, apiKey, provider, model },
        });
        if (error) {
          throw error;
        }
        return data;
      } catch (error: any) {
        const shouldRotate = error.message?.toLowerCase().includes('invalid') || error.status === 401 || error.status === 429;
        if (shouldRotate && attempt < maxRetries - 1) {
          addLog(`🔑 API Key rotiert für ${provider}.`);
          await rotateApiKey(provider);
          continue; // Nächster Versuch mit neuem Key
        }
        throw error; // Finaler Fehler nach Retries
      }
    }
  };

  const handleSend = useCallback(
    async (customPrompt?: string) => {
      // KORREKTUR: Der gesamte Block ist jetzt in einem try...catch...finally
      const originalMessages = messages; // Speichere originalMessages für Rollback
      let userMessage: ChatMessage | null = null; // Deklariere userMessage hier

      try {
        const userPrompt = customPrompt ?? textInput.trim();
        const fileToSend = selectedFileAsset;
        if ((!userPrompt && !fileToSend && !customPrompt) || !supabase || !projectData) return;

        setIsAiLoading(true);
        setError(null);

        // 1. Nachrichten-Vorbereitung
        let messageForHistory = userPrompt;
        if (fileToSend && !customPrompt) {
          const fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, { encoding: 'utf8' });
          messageForHistory = `---Datei:${fileToSend.name}---\n${fileContent}\nEnde ---\n\n${userPrompt || '(Siehe Datei)'}`;
        }

        userMessage = { // Weise userMessage hier zu
          _id: uuid.v4() as string, // KORREKTUR: Verwende react-native-uuid
          text: textInput.trim() || '(Datei)',
          createdAt: new Date(),
          user: { _id: 1, name: 'User' },
        };

        // VORÜBERGEHENDE Speicherung der User Message im State und History
        setTextInput('');
        if (fileToSend && !customPrompt) setSelectedFileAsset(null);
        
        // Stelle sicher, dass die History aktuell ist, BEVOR die neue Nachricht hinzugefügt wird
        historyRef.current.loadFromMessages(originalMessages);
        historyRef.current.addUser(messageForHistory);
        
        const messagesToSave = [userMessage, ...originalMessages];
        await updateMessages(messagesToSave);

        let groqRawResponse: string = '';
        let currentProvider: AllAIProviders = CHAT_PROVIDER;

        // --- 2. Generator Call (Groq) ---
        currentProvider = CHAT_PROVIDER;
        const groqPromptMessages = buildPrompt('generator', CHAT_PROVIDER, messageForHistory, projectData.files, historyRef.current.getHistory());
        const groqData = await callProviderWithRetry(CHAT_PROVIDER, groqPromptMessages, config.selectedChatMode);
        groqRawResponse = groqData?.response?.trim() || '';
        if (!groqRawResponse) throw new Error(`${CHAT_PROVIDER} lieferte keine Antwort`);

        historyRef.current.addAssistant(groqRawResponse); // Generator-Antwort zur History hinzufügen

        let finalProjectFiles: any[] | null = null;
        let finalAiTextMessage: string | null = null;

        // --- 3. JSON-Validierung & Agent Call ---
        let jsonRetryAttempt = 0;
        let isJsonValid = false;

        while (jsonRetryAttempt < MAX_JSON_RETRIES && !isJsonValid) {
          const potentialJsonString = extractJsonArray(groqRawResponse);

          if (config.qualityMode === 'speed') {
            // --- Speed Mode ---
            if (potentialJsonString) {
              finalProjectFiles = tryParseJsonWithRepair(potentialJsonString);
              if (finalProjectFiles) {
                isJsonValid = true;
              }
            } else {
              finalAiTextMessage = groqRawResponse;
              isJsonValid = true; // Es war eine Textantwort, kein JSON erwartet
            }
          } else {
            // --- Quality Mode (Agent) ---
            currentProvider = AGENT_PROVIDER;
            const agentPromptMessages = buildPrompt('agent', AGENT_PROVIDER, groqRawResponse, projectData.files, historyRef.current.getHistory(), userPrompt);
            const agentData = await callProviderWithRetry(AGENT_PROVIDER, agentPromptMessages, config.selectedAgentMode);
            const agentResponse = agentData?.response?.trim() || '';
            if (!agentResponse) throw new Error('Agent lieferte keine Antwort');

            const agentJsonString = extractJsonArray(agentResponse);
            if (agentJsonString) {
              finalProjectFiles = tryParseJsonWithRepair(agentJsonString);
              if (finalProjectFiles) {
                isJsonValid = true;
              }
            } else {
              finalAiTextMessage = agentResponse; // Agent gab Text zurück (z.B. bei Fehler)
              isJsonValid = true;
            }
          }

          // --- Retry-Logik für JSON ---
          if (!isJsonValid && jsonRetryAttempt < MAX_JSON_RETRIES - 1) {
            jsonRetryAttempt++;
            addLog(`🔄 JSON ungültig (Versuch ${jsonRetryAttempt}/${MAX_JSON_RETRIES}). Fordere Korrektur an...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * jsonRetryAttempt));
            
            const retryPrompt = `Die vorherige Antwort war kein gültiges JSON. Antworte NUR mit validem JSON-Array:\n\n${groqRawResponse}\n\nFormat: [{"path":"file.js","content":"code"}]`;
            
            groqRawResponse = `{"error": "Ungültiges JSON", "original": "${groqRawResponse}"}`; 
            
            if (config.qualityMode === 'speed') {
                if(jsonRetryAttempt >= MAX_JSON_RETRIES - 1) {
                   finalAiTextMessage = "Fehler: Ungültiges JSON vom Generator erhalten.";
                   isJsonValid = true; // Breche die Schleife ab
                }
            }

          } else if (!isJsonValid) {
             jsonRetryAttempt++; // Letzter Versuch
          }
        } // Ende JSON-Retry-Schleife

        // --- 4. Verarbeitung der finalen Antwort ---
        let aiMessageTextToShow: string;
        if (finalProjectFiles) {
          await updateProjectFiles(finalProjectFiles);
          aiMessageTextToShow = `✅ Projekt aktualisiert (${finalProjectFiles.length} Dateien${config.qualityMode === 'quality' ? ' - Agent geprüft' : ''})`;
          if (jsonRetryAttempt > 0) {
            aiMessageTextToShow += ` [Fix nach ${jsonRetryAttempt} Versuchen]`;
          }
        } else if (finalAiTextMessage) {
          aiMessageTextToShow = finalAiTextMessage;
        } else {
          aiMessageTextToShow = '❌ Fehler: Ungültiges JSON-Format nach Retries.';
          setError(aiMessageTextToShow);
        }

        // AI Message hinzufügen
        const aiMessage: ChatMessage = {
          _id: uuid.v4() as string, // KORREKTUR: Verwende react-native-uuid
          text: aiMessageTextToShow,
          createdAt: new Date(),
          user: { _id: 2, name: 'AI' },
        };
        await updateMessages([aiMessage, ...messagesToSave]); // Füge die AI-Antwort ZUSÄTZLICH zu den gespeicherten Nachrichten hinzu

      // --- 5. Finales Error Handling (Catch-Block) ---
      // KORREKTUR: Sichere 'catch (e)' Syntax für ältere Bundler
      } catch (e) { 
        const error = e as Error;
        console.error(`❌ Send Fail (Final):`, error);
        Alert.alert('Fehler', error.message || 'Unbekannter Fehler');
        setError(error.message);
        
        // Rollback: Entferne die temporäre User Message
        await updateMessages(originalMessages);
        historyRef.current.loadFromMessages(originalMessages); // Setze History zurück
      } finally {
        setIsAiLoading(false);
      }
    },
    [textInput, selectedFileAsset, supabase, config, projectData, messages, getCurrentApiKey, rotateApiKey, updateProjectFiles, updateMessages, setTextInput, setSelectedFileAsset, setIsAiLoading, setError, addLog]
  );


  const handleDebugLastResponse = useCallback(() => {
    const lastAiMessage = messages.find(m => m.user._id === 2);
    if (!lastAiMessage?.text || lastAiMessage.text.startsWith('✅')) {
      Alert.alert('Nichts zu debuggen', 'Keine gültige Textantwort von der KI gefunden.');
      return;
    }
    const prompt = `Analysiere:\n\n\`\`\`\n${lastAiMessage.text}\n\`\`\``;
    setTextInput('Debug Anfrage...');
    handleSend(prompt);
  }, [messages, setTextInput, handleSend]);

  const handleExpoGo = useCallback(() => {
    if (!projectData) {
      Alert.alert('Fehler', 'Kein Projekt geladen');
      return;
    }
    // HINWEIS: Diese IP muss manuell an Ihr lokales Netzwerk angepasst werden.
    const metroHost = '192.168.43.1:8081'; // Beispiel-IP
    const expUrl = `exp://${metroHost}`;
    Alert.alert(
      'Expo Go Vorschau',
      `Stellen Sie sicher, dass Metro auf dem Host läuft und Ihr Gerät im selben Netzwerk ist.\n\nURL: ${expUrl}`,
      [
        { text: 'URL kopieren', onPress: () => Clipboard.setStringAsync(expUrl) },
        { text: 'OK' },
      ]
    );
    addLog(`Expo Go URL (Manuell): ${expUrl}`);
  }, [projectData, addLog]);

  // KORREKTUR: loadHistoryFromMessages wird nicht mehr exportiert.
  return {
    handlePickDocument,
    handleSend,
    handleDebugLastResponse,
    handleExpoGo,
  };
};



