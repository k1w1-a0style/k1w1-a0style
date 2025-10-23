import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator, Alert, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { ensureSupabaseClient } from '../lib/supabase';
import { theme, HEADER_HEIGHT } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAI } from '../contexts/AIContext';
import { useTerminal } from '../contexts/TerminalContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProject, ProjectFile, ProjectData } from '../contexts/ProjectContext'; 
import * as Clipboard from 'expo-clipboard';

// Typen
interface ChatMessage { _id: string; text: string; createdAt: Date; user: { _id: number; name: string; }; isStreaming?: boolean; }
type DocumentResultAsset = NonNullable<DocumentPicker.DocumentPickerResult['assets']>[0];
const LAST_AI_RESPONSE_KEY = 'k1w1_last_ai_response_v2';

// JSON Säuberungsfunktion
const sanitizeJsonString = (str: string): string => {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
};

// MessageItem Komponente
const MessageItem = memo(({ item }: { item: ChatMessage }) => { const messageText = item.text ? String(item.text).trim() : ''; if (item.user._id === 1 && messageText.length === 0) { return null; } const handleLongPress = () => { if (messageText.length > 0) { Clipboard.setStringAsync(messageText); Alert.alert("Kopiert", "Nachricht in Zwischenablage kopiert."); } }; return ( <Pressable style={({ pressed }) => [ styles.messageBubble, item.user._id === 1 ? styles.userMessage : styles.aiMessage, pressed && styles.messagePressed ]} onLongPress={handleLongPress} > <Text style={item.user._id === 1 ? styles.userMessageText : styles.aiMessageText}> {messageText.length > 0 ? messageText : '...'} </Text> </Pressable> ); });


const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]); 
  const [textInput, setTextInput] = useState(''); 
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null); 
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null); 
  const { config, getCurrentApiKey, rotateApiKey } = useAI(); 
  const { addLog } = useTerminal(); 
  const [selectedFileAsset, setSelectedFileAsset] = useState<DocumentResultAsset | null>(null);
  
  // === Angepasst an Single-Project Context ===
  const { projectData, updateProject, isLoading: isProjectLoading } = useProject();
  // === ENDE ===

  // loadClient, useFocusEffect, handlePickDocument (unverändert)
  const loadClient = useCallback(async () => { setError(null); try { const c = await ensureSupabaseClient(); setSupabase(c); console.log("CS: Supa OK"); } catch (e:any) { setError("Supa Load Fail"); } }, []); 
  useFocusEffect(useCallback(() => { loadClient(); }, [loadClient])); 
  const handlePickDocument = async () => { try { const r=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory: true}); if(!r.canceled&&r.assets&&r.assets.length>0){const a=r.assets[0];setSelectedFileAsset(a);Alert.alert('Datei ok',`${a.name} (${a.size?(a.size/1024).toFixed(2)+' KB':'?'}) wird gesendet.`);}else{setSelectedFileAsset(null);}}catch(e){console.error('Pick Fail:',e);Alert.alert('Fehler','Datei Wahl fehlgeschlagen.');setSelectedFileAsset(null);}};

  // handleSend
  const handleSend = useCallback(async (isRetry = false, customPrompt?: string, keyToUse?: string | null) => {
    let userPrompt = customPrompt ?? textInput.trim(); 
    const fileToSend = selectedFileAsset; 
    const displayPrompt = textInput.trim() || (fileToSend ? `(Datei gesendet: ${fileToSend.name})` : (customPrompt ? `Debug Anfrage` : '')); 
    if (!userPrompt && !fileToSend && !customPrompt) return; 
    if (!supabase) { Alert.alert("Fehler", "Supabase ist nicht verbunden."); return; } 
    // WICHTIGER CHECK: projectData kann null sein, wenn der Provider noch lädt
    if (isProjectLoading || !projectData) { Alert.alert("Fehler", "Projekt-Context lädt noch. Bitte kurz warten."); return; }
    
    if (!isRetry) setError(null); 
    
    const currentProvider = config.selectedProvider; 
    const apiKey = keyToUse ?? getCurrentApiKey(currentProvider); 
    if (!apiKey) { Alert.alert('Key fehlt', `Kein API Key für ${currentProvider.toUpperCase()} gefunden.`); return; } 

    let fileContent = ''; let combinedPrompt = userPrompt; 
    if (fileToSend && !customPrompt && !isRetry) { setIsLoading(true); console.log(`Lese: ${fileToSend.uri}`); try { fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, { encoding: 'utf8' }); console.log(`Gelesen: ${fileContent.length} chars`); combinedPrompt = `--- Datei: ${fileToSend.name} ---\n${fileContent}\n--- Ende ---\n\n${userPrompt||'(Siehe Datei)'}`; } catch (readError: any) { console.error("Read Fail:",readError); Alert.alert("Lese-Fehler", `Datei "${fileToSend.name}" Error.`); setIsLoading(false); setSelectedFileAsset(null); return; } } 
    else if (fileToSend && !customPrompt && isRetry) { combinedPrompt = userPrompt; if (displayPrompt === `(Datei gesendet: ${fileToSend.name})`) { userPrompt = displayPrompt; } } 
    
    if (!isRetry) { const userMessage: ChatMessage = { _id: Math.random().toString(36).substring(7), text: displayPrompt || '...', createdAt: new Date(), user: { _id: 1, name: 'User' } }; setMessages((prev) => [userMessage, ...prev]); setTextInput(''); if(fileToSend && !customPrompt) setSelectedFileAsset(null); }

    if (!isRetry) {
        // === Angepasst an Single-Project ===
        const currentProjectState = JSON.stringify(projectData?.files || [], null, 2); 
        // === ENDE ===

        // === STARKER PROMPT-FIX (gegen HTML) ===
        const AGENT_SYSTEM_PROMPT = `Du bist "k1w1-a0style", ein Experte für **React Native mit Expo**. Deine Aufgabe ist es, mobile Apps für Android und iOS zu bauen.\n**FOKUS: NUR React Native & Expo.** KEIN HTML, KEIN CSS, KEIN reines JavaScript für den Browser.\n\n**WICHTIG:** Du musst **IMMER** entscheiden, ob die User-Anfrage **Code-Generierung** oder **normalen Chat** erfordert.\n\n**AKTUELLES PROJEKT (React Native / Expo):**\n\`\`\`json\n${currentProjectState}\n\`\`\`\n(\`[]\` bedeutet leeres Projekt)\n\n**USER-ANFRAGE:**\n---\n${combinedPrompt}\n---\n\n**DEINE AKTION:**\n\n1.  **FALL: CODE-GENERIERUNG / MODIFIKATION (React Native / Expo)**\n    * Wenn der User explizit sagt "Baue", "Erstelle", "Füge hinzu", "Ändere", "Implementiere" etc. **bezogen auf die React Native App**.\n    * **ANTWORT-FORMAT:** NUR das **komplette, aktualisierte React Native / Expo Projekt** als JSON-Array:\n        \`\`\`json\n        [\n          {"path": "package.json", "content": "{...}"},\n          {"path": "app.config.js", "content": "module.exports = {...};"},\n          {"path": "App.tsx", "content": "import React from 'react'; ..."}\n        ]\n        \`\`\`\n    * **PFLICHTDATEIEN:** Füge **IMMER** mindestens 'package.json', 'app.config.js' (oder 'app.json') und 'App.tsx' hinzu.\n    * **KEIN ZUSATZTEXT!** Nur das JSON.\n\n2.  **FALL: CHAT / FRAGE / RÜCKFRAGE / ANDERE ANFRAGEN**\n    * Wenn der User chattet, Fragen stellt, **oder wenn DU eine Rückfrage hast**, oder wenn der User **etwas anderes als React Native Code** verlangt (z.B. HTML).\n    * **ANTWORT-FORMAT:** Normaler, freundlicher **Text**. Erkläre ggf., warum du die Anfrage nicht (als Code) erfüllen kannst.\n\n**BEISPIEL:** User: "Baue eine Hello World App". Antwort: \`[{"path": "package.json", ...}, {"path": "App.tsx", ...}]\` (KEIN TEXT DRUMHERUM)\n**BEISPIEL:** User: "Mach mir eine HTML Seite". Antwort: "Ich bin darauf spezialisiert, React Native Apps zu bauen. Möchtest du stattdessen eine einfache React Native App erstellen?"\n`;
        combinedPrompt = AGENT_SYSTEM_PROMPT;
    }


    setIsLoading(true); 
    let effectiveModel = config.selectedMode; 
    if (currentProvider === 'groq' && effectiveModel === 'auto-groq'){ effectiveModel = 'llama-3.1-8b-instant'; console.log(`AutoGroq -> ${effectiveModel}`); } 
    const currentKeyIndex = config.keys[currentProvider]?.indexOf(apiKey) ?? -1; 
    console.log(`Sende: ${currentProvider}, ${effectiveModel}, KeyIdx:${currentKeyIndex !== -1 ? currentKeyIndex : '?'}`); 

    try {
      const { data, error: funcErr } = await supabase.functions.invoke('k1w1-handler', { body: { message: combinedPrompt, apiKey: apiKey, provider: currentProvider, model: effectiveModel }, }); 
      if (funcErr) { const s = funcErr.context?.status||500; const d = funcErr.context?.details||funcErr.message; throw { name: 'FunctionsHttpError', status: s, message: d }; } 
      
      let aiText = data?.response; 
      if (aiText && typeof aiText === 'string') { aiText = aiText.trim(); aiText = sanitizeJsonString(aiText); } else { aiText = ""; } 
      
      if (aiText.length > 0) { 
        const aiMsg: ChatMessage = { _id: Math.random().toString(36).substring(7), text: aiText, createdAt: new Date(), user: { _id: 2, name: 'AI' } }; 
        setMessages((prev) => [aiMsg, ...prev]); 
        try { 
          const jsonMatch = aiText.match(/\[\s*\{[\s\S]*?\}\s*\]/); 
          if (jsonMatch && jsonMatch[0]) { 
             const potentialJson = jsonMatch[0]; 
             let parsedProject: any[] | null = null; 
             try { 
                 parsedProject = JSON.parse(sanitizeJsonString(potentialJson)); 
                 if (Array.isArray(parsedProject)) { parsedProject = parsedProject.map((file) => ({ ...file, content: typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2) })); } 
             } catch (parseError: any) { console.warn("JSON-Parse-Fehler trotz Säuberung:", parseError.message); throw new Error(`Antwort enthält JSON, aber Parsing fehlgeschlagen: ${parseError.message}`); } 
             
             const validatedProject = parsedProject as ProjectFile[]; 
             if (Array.isArray(validatedProject) && validatedProject.length > 0 && validatedProject[0]?.path && validatedProject[0]?.content !== undefined && typeof validatedProject[0].content === 'string') {  
                // === NEUER Context Hook ===
                await updateProject(validatedProject); // Verwende updateProject
                // === ENDE ===
                console.log(`Projekt-Struktur mit ${validatedProject.length} Dateien gespeichert.`); setMessages((prev) => { const newMsgs = [...prev]; if (newMsgs[0]?._id === aiMsg._id) { newMsgs[0].text = `[Projekt mit ${validatedProject.length} Dateien aktualisiert. Siehe Code-Tab.]`; } return newMsgs; }); await AsyncStorage.setItem(LAST_AI_RESPONSE_KEY, `[Projekt mit ${validatedProject.length} Dateien aktualisiert. Siehe Code-Tab.]`); 
             } else { 
                // Spezieller Fall: KI sendet leeres Array, um Projekt zu löschen? (Ignorieren wir erstmal)
                if (Array.isArray(validatedProject) && validatedProject.length === 0) {
                     throw new Error("Antwort ist normaler Text (leeres JSON-Array).");
                }
                throw new Error("Geparstes/Konvertiertes JSON ist kein gültiges Projektformat."); 
             } 
          } else { throw new Error("Antwort ist normaler Text (kein JSON-Array-Match)."); } 
        } catch (jsonError: any) { 
            try { await AsyncStorage.setItem(LAST_AI_RESPONSE_KEY, aiText); if (jsonError.message.includes("normaler Text")) { console.log("Letzte KI-Antwort (als Text) gespeichert."); } else { console.warn("Fehler bei JSON-Verarbeitung, als Text gespeichert:", jsonError.message); } } 
            catch (saveError) { console.error("Speicherfehler:", saveError); } 
        } 
      } else { setError('Leere oder ungültige Antwort von KI.'); console.warn('Leere Antwort erhalten.'); } 
    } catch (e: any) { 
        // ... (Key-Rotation etc. unverändert) ...
        console.error('Send Fail:', e); let detailMsg = e.message||'?'; let status = e.status||500; if (status >= 400 && status < 500) { console.log(`Key Problem (${status}), rotiere...`); addLog(`Key ${currentProvider} (${status}). Rotiere...`); const nextKey = await rotateApiKey(currentProvider); if (nextKey && nextKey !== apiKey) { console.log("Retry new Key..."); if (fileToSend && !selectedFileAsset && !customPrompt) { console.log("Stelle Datei für Retry wieder her."); setSelectedFileAsset(fileToSend); } handleSend(true, combinedPrompt, nextKey); return; } else { detailMsg = `Alle ${currentProvider.toUpperCase()} Keys verbraucht.`; Alert.alert("Keys leer", detailMsg); addLog(`Alle ${currentProvider} Keys leer.`); if (fileToSend && !customPrompt) setSelectedFileAsset(null); } } else { Alert.alert('Sende-Fehler', detailMsg); if (fileToSend && !customPrompt) setSelectedFileAsset(null); } setError(detailMsg); if (!isRetry || detailMsg.includes("Alle Keys")) { setMessages(prev => prev.slice(1)); } 
    } finally { setIsLoading(false); }
  }, [textInput, supabase, getCurrentApiKey, rotateApiKey, addLog, config, selectedFileAsset, messages, 
      // === NEUES Dependency Array ===
      projectData, 
      updateProject 
  ]); 
  // === ENDE ===

  // useEffect Debug, handleDebugLastResponse (unverändert)
  useEffect(() => { if (route.params?.debugCode) { const codeToDebug = route.params.debugCode; console.log("ChatScreen: Debug-Anfrage vom CodeScreen empfangen."); const debugPrompt = `Analysiere den folgenden Code auf Fehler, schlage Verbesserungen vor und erkläre deine Analyse:\n\n\`\`\`\n${codeToDebug}\n\`\`\``; setTextInput(`Debug Anfrage...`); handleSend(false, debugPrompt); navigation.setParams({ debugCode: undefined }); } }, [route.params?.debugCode, navigation, handleSend]);
  const handleDebugLastResponse = () => { const lastAiMsg = messages.find(m => m.user._id === 2); if (!lastAiMsg || !lastAiMsg.text) { Alert.alert("Nix da", "Keine KI Antwort zum Debuggen."); return; } const code = lastAiMsg.text; const prompt = `Analysiere den folgenden Code (oder Text) auf Fehler, schlage Verbesserungen vor:\n\n\`\`\`\n${code}\n\`\`\``; setTextInput(`Debug Anfrage...`); handleSend(false, prompt); };

  const isSupabaseReady = supabase && !supabase.functions.invoke.toString().includes('DUMMY_CLIENT');

  // Render-JSX (unverändert)
  return ( <SafeAreaView style={styles.safeArea}> <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"} style={styles.keyboardAvoidingContainer} keyboardVerticalOffset={Platform.OS === "ios" ? HEADER_HEIGHT + 20 : HEADER_HEIGHT + 40}> {!supabase && (<ActivityIndicator style={styles.loadingIndicator} color={theme.palette.primary} size="large" />)} <FlatList data={messages} renderItem={({ item }) => <MessageItem item={item} />} keyExtractor={(item) => item._id} inverted={true} style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" initialNumToRender={10} maxToRenderPerBatch={5} windowSize={10}/> {error && (<View style={styles.errorContainer}><Text style={styles.error}>{String(error)}</Text></View>)} <View style={styles.inputContainerOuter}> {selectedFileAsset && ( <View style={styles.attachedFileContainer}> <Ionicons name="document-attach-outline" size={16} color={theme.palette.text.secondary} /> <Text style={styles.attachedFileText} numberOfLines={1}>{selectedFileAsset.name}</Text> <TouchableOpacity onPress={()=>setSelectedFileAsset(null)} style={styles.removeFileButton}> <Ionicons name="close-circle" size={18} color={theme.palette.text.secondary} /> </TouchableOpacity> </View> )} <View style={styles.inputContainerInner}> <TouchableOpacity onPress={handlePickDocument} style={styles.attachButton} disabled={isLoading || isProjectLoading}> <Ionicons name="add-circle-outline" size={28} color={isLoading||isProjectLoading?theme.palette.text.disabled:theme.palette.primary} /> </TouchableOpacity> <TouchableOpacity onPress={handleDebugLastResponse} style={styles.debugButton} disabled={isLoading || isProjectLoading || messages.filter(m=>m.user._id === 2).length === 0}> <Ionicons name="bug-outline" size={24} color={isLoading || isProjectLoading || messages.filter(m=>m.user._id === 2).length === 0 ? theme.palette.text.disabled : theme.palette.primary} /> </TouchableOpacity> <TextInput style={styles.input} placeholder={!isSupabaseReady?"Lade...":(selectedFileAsset?"Zusätzl...":"Nachricht...")} placeholderTextColor={theme.palette.text.secondary} value={textInput} onChangeText={setTextInput} editable={!isLoading&&isSupabaseReady&&!isProjectLoading} multiline /> <TouchableOpacity onPress={()=>handleSend(false)} disabled={isLoading || !isSupabaseReady || isProjectLoading || (!textInput.trim() && !selectedFileAsset)} style={[styles.sendButton, (!isSupabaseReady || isLoading || isProjectLoading || (!textInput.trim() && !selectedFileAsset)) && styles.sendButtonDisabled]} > {isLoading ? <ActivityIndicator size="small" color={theme.palette.background} /> : <Ionicons name="send" size={24} color={theme.palette.background} />} </TouchableOpacity> </View> </View> </KeyboardAvoidingView> </SafeAreaView> );
};

// Styles (unverändert)
const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:theme.palette.background}, keyboardAvoidingContainer:{flex:1}, list:{flex:1}, listContent:{paddingVertical:10,paddingHorizontal:10}, messageBubble:{borderRadius:15,paddingVertical:10,paddingHorizontal:14,marginBottom:8,maxWidth:'80%'}, userMessage:{backgroundColor:theme.palette.primary,alignSelf:'flex-end',borderBottomRightRadius:0}, aiMessage:{backgroundColor:theme.palette.card,alignSelf:'flex-start',borderBottomLeftRadius:0}, messagePressed: { opacity: 0.7 }, userMessageText:{fontSize:16,color:theme.palette.background}, aiMessageText:{fontSize:16,color:theme.palette.text.primary}, inputContainerOuter:{borderTopWidth:1,borderTopColor:theme.palette.card,backgroundColor:theme.palette.background}, attachedFileContainer:{flexDirection:'row',alignItems:'center',backgroundColor:theme.palette.input.background,paddingVertical:6,paddingHorizontal:12,marginHorizontal:10,marginTop:8,borderRadius:15,borderWidth:1,borderColor:theme.palette.card}, attachedFileText:{flex:1,marginLeft:8,marginRight:8,fontSize:13,color:theme.palette.text.secondary}, removeFileButton:{padding:2}, inputContainerInner:{flexDirection:'row',paddingHorizontal:10,paddingVertical:8,alignItems:'center'}, attachButton:{paddingRight:5,justifyContent:'center',alignItems:'center',height:44}, debugButton:{paddingHorizontal:8,justifyContent:'center',alignItems:'center',height:44}, input:{flex:1,backgroundColor:theme.palette.input.background,borderRadius:20,paddingHorizontal:15,paddingVertical:Platform.OS==='ios'?10:8,color:theme.palette.text.primary,fontSize:16,maxHeight:100}, sendButton:{backgroundColor:theme.palette.primary,borderRadius:25,width:44,height:44,justifyContent:'center',alignItems:'center',paddingLeft:3,marginLeft:5}, sendButtonDisabled:{backgroundColor:theme.palette.text.secondary}, errorContainer:{paddingHorizontal:10,paddingBottom:5}, error:{color:theme.palette.error,textAlign:'center'}, loadingIndicator:{marginVertical:30},
});

export default ChatScreen;

