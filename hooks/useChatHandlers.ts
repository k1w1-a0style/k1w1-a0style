
import { useCallback, useRef } from 'react';
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
import { v4 as uuidv4 } from 'uuid';

// Maximal 3 Versuche für JSON-Reparatur
const MAX_JSON_RETRIES = 3;

export const useChatHandlers = (
  supabase: SupabaseClient | null,
  textInput: string,
  setTextInput: (value: string) => void,
  selectedFileAsset: any | null,
  setSelectedFileAsset: (asset: any | null) => void,
  setIsAiLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) => {
  const { projectData, updateProjectFiles, messages, updateMessages } = useProject();
  const { config, getCurrentApiKey, rotateApiKey, updateConfig } = useAI();
  const { addLog } = useTerminal();
  const historyRef = useRef(new ConversationHistory());

  const loadHistoryFromMessages = useCallback(() => {
    historyRef.current.loadFromMessages(messages);
  }, [messages]);

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

  const handleSend = useCallback(
    async (customPrompt?: string) => {
      const userPrompt = customPrompt ?? textInput.trim();
      const fileToSend = selectedFileAsset;
      if ((!userPrompt && !fileToSend && !customPrompt) || !supabase || !projectData) return;

      setIsAiLoading(true);
      setError(null);

      // Speichere originalMessages für Rollback bei Fehler
      const originalMessages = messages;
      let messagesToSave = [...originalMessages]; 
      
      let messageForHistory = userPrompt;
      if (fileToSend && !customPrompt) {
        const fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, { encoding: 'utf8' });
        messageForHistory = `---Datei:${fileToSend.name}---\n${fileContent}\nEnde ---\n\n${userPrompt || '(Siehe Datei)'}`;
      }

      // VORÜBERGEHENDE Speicherung der User Message im State und History
      const userMessage: ChatMessage = {
          _id: uuidv4(),
          text: textInput.trim() || '(Datei)',
          createdAt: new Date(),
          user: { _id: 1, name: 'User' },
      };
      
      setTextInput('');
      if (fileToSend && !customPrompt) setSelectedFileAsset(null);
      
      historyRef.current.addUser(messageForHistory);
      messagesToSave.unshift(userMessage);
      await updateMessages(messagesToSave);

      // --- Start des Haupt-Try-Blocks ---
      try {
          
          let finalProjectFiles: any[] | null = null;
          let finalAiTextMessage: string | null = null;
          let currentProvider = CHAT_PROVIDER;
          let groqRawResponse: string = '';
          
          const callProviderWithRetry = async (provider: AllAIProviders, promptMessages: PromptMessage[], model: string, maxRetries = 3): Promise<any> => {
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              const apiKey = getCurrentApiKey(provider);
              if (!apiKey) throw new Error(`Keine API Keys für ${provider} verfügbar`);
              try {
                const { data, error } = await supabase.functions.invoke('k1w1-handler', {
                  body: { messages: promptMessages, apiKey, provider, model },
                });
                if (error) throw error;
                return data;
              } catch (e) {
                const error = e as any;
                const shouldRotate = error.message?.toLowerCase().includes('invalid') || error.status === 401 || error.status === 429;
                if (shouldRotate && attempt < maxRetries - 1) {
                  const newKey = await rotateApiKey(provider);
                  if (newKey) {
                    addLog(`🔑 Key rotiert für ${provider}. Versuch ${attempt + 2}/${maxRetries}.`);
                    continue;
                  }
                }
                throw error;
              }
            }
          };
          
          // Separate JSON Parsing & Validation Loop (Phase 3 Vorgriff)
          let jsonRetryAttempt = 0;
          let isJsonValid = false;

          while(jsonRetryAttempt < MAX_JSON_RETRIES && !isJsonValid) {
              try {
                  if (jsonRetryAttempt > 0) {
                      addLog(`🔄 JSON Validation Retry ${jsonRetryAttempt}/${MAX_JSON_RETRIES} gestartet...`);
                      await new Promise(resolve => setTimeout(resolve, 1000 * jsonRetryAttempt));
                  }

                  // --- 3a. Generator Call (Groq) ---
                  currentProvider = CHAT_PROVIDER;
                  const groqPromptMessages = buildPrompt('generator', CHAT_PROVIDER, messageForHistory, projectData.files, historyRef.current.getHistory());
                  const groqData = await callProviderWithRetry(CHAT_PROVIDER, groqPromptMessages, config.selectedChatMode);
                  groqRawResponse = groqData?.response?.trim() || '';

                  if (!groqRawResponse) throw new Error(`${CHAT_PROVIDER} lieferte keine Antwort`);
                  
                  // Nur beim ersten Versuch zur History hinzufügen
                  if (jsonRetryAttempt === 0) {
                      historyRef.current.addAssistant(groqRawResponse);
                  }

                  const potentialJsonString = extractJsonArray(groqRawResponse);

                  if (config.qualityMode === 'speed') {
                      finalProjectFiles = potentialJsonString ? tryParseJsonWithRepair(potentialJsonString) : null;
                  } else {
                      // --- 3b. Agent Call (Gemini) ---
                      currentProvider = AGENT_PROVIDER;
                      const agentPromptMessages = buildPrompt('agent', AGENT_PROVIDER, groqRawResponse, projectData.files, historyRef.current.getHistory(), userPrompt);
                      const agentData = await callProviderWithRetry(AGENT_PROVIDER, agentPromptMessages, config.selectedAgentMode);
                      const agentResponse = agentData?.response?.trim() || '';

                      if (!agentResponse) throw new Error('Agent lieferte keine Antwort');

                      const agentJsonString = extractJsonArray(agentResponse);
                      finalProjectFiles = agentJsonString ? tryParseJsonWithRepair(agentJsonString) : null;

                      if (finalProjectFiles === null) {
                          finalAiTextMessage = agentResponse;
                      }
                  }

                  if (finalProjectFiles) {
                      isJsonValid = true;
                  } else if (config.qualityMode === 'speed' && !potentialJsonString) {
                      // Generator hat Text geliefert, kein JSON erwartet
                      isJsonValid = true;
                      finalAiTextMessage = groqRawResponse;
                  } else if (config.qualityMode === 'quality' && finalAiTextMessage) {
                       // Agent hat Text geliefert (z.B. Erklärung), kein JSON erwartet
                       isJsonValid = true;
                  }

              } catch (e) { // Sicherer Catch-Block
                  const error = e as Error;
                  const errorMessage = error.message || 'Unbekannter API Fehler';
                  addLog(`❌ API/JSON Fehler: ${errorMessage}`);
                  finalAiTextMessage = `Fehler bei der KI-Verarbeitung: ${errorMessage}`;
                  
                  // Wenn es ein API-Fehler ist, den Retry-Loop verlassen.
                  if (!errorMessage.includes('Invalid JSON') && !errorMessage.includes('Colon expected')) {
                      jsonRetryAttempt = MAX_JSON_RETRIES; 
                      isJsonValid = true; // Loop verlassen und Fehler anzeigen
                  } else {
                      // Bei JSON-Fehler weitermachen
                  }
              }
              
              jsonRetryAttempt++;
          } // Ende while-Schleife

          // --- 4. Verarbeitung und Speicherung der finalen Antwort ---
          let aiMessageTextToShow: string;
          
          if (finalProjectFiles) {
            // Code-Update erfolgreich
            await updateProjectFiles(finalProjectFiles);
            aiMessageTextToShow = `✅ Projekt aktualisiert (${finalProjectFiles.length} Dateien${config.qualityMode === 'quality' ? ' - Agent geprüft' : ''})`;
            if(jsonRetryAttempt > 1) {
                aiMessageTextToShow += ` [Fix nach ${jsonRetryAttempt - 1} Wiederholung(en)]`;
            }
          } else if (finalAiTextMessage) {
            // Text-Antwort oder finaler Fehler
            aiMessageTextToShow = finalAiTextMessage;
          } else {
            // Fallback, wenn alles fehlschlägt
            aiMessageTextToShow = '❌ Schwerer Fehler: Keine gültige Code- oder Text-Antwort erhalten.';
            setError(aiMessageTextToShow);
          }

          // AI Message hinzufügen - Wir behalten die User Message, die schon im State ist.
          const aiMessage: ChatMessage = {
              _id: uuidv4(),
              text: aiMessageTextToShow,
              createdAt: new Date(),
              user: { _id: 2, name: 'AI' },
          };
          
          // Füge die neue AI Message zur History hinzu (User Message ist schon da)
          await updateMessages([aiMessage, ...messagesToSave]);

      } catch (e) { // Sicherer Catch-Block für den äußeren Try
          const error = e as Error;
          console.error(`❌ Send Fail (Final):`, error);
          Alert.alert('Fehler', error.message || 'Unbekannter Fehler');
          setError(error.message);

          // Beim finalen Fehler die temporäre User Message wieder entfernen
          await updateMessages(originalMessages);
          historyRef.current.loadFromMessages(originalMessages);
      } finally {
        setIsAiLoading(false);
      }
    },
    [textInput, selectedFileAsset, supabase, config, projectData, messages, getCurrentApiKey, rotateApiKey, updateProjectFiles, updateMessages, setTextInput, setSelectedFileAsset, setIsAiLoading, setError, addLog]
  );

  const handleDebugLastResponse = useCallback(() => {
    const lastAiMessage = messages.find(m => m.user._id === 2);
    if (!lastAiMessage?.text || lastAiMessage.text.startsWith('✅ Projekt')) {
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
    const metroHost = '10.212.162.31:8081';
    const expUrl = `exp://${metroHost}`;
    Alert.alert(
      'Expo Go Vorschau',
      `Öffne Expo Go und scanne den QR-Code oder öffne:\n\n${expUrl}`,
      [
        { text: 'URL kopieren', onPress: () => Clipboard.setStringAsync(expUrl) },
        { text: 'OK' },
      ]
    );
    addLog(`Expo Go URL: ${expUrl}`);
  }, [projectData, addLog]);

  return {
    handlePickDocument,
    handleSend,
    handleDebugLastResponse,
    handleExpoGo,
    loadHistoryFromMessages,
  };
};

