import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator,
  Alert, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { ensureSupabaseClient } from '../lib/supabase';
import { theme, HEADER_HEIGHT } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAI } from '../contexts/AIContext'; // useAI importieren
import { useTerminal } from '../contexts/TerminalContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Interface/Typ Definitionen
interface ChatMessage { _id: string; text: string; createdAt: Date; user: { _id: number; name: string; }; isStreaming?: boolean; }
type DocumentResultAsset = NonNullable<DocumentPicker.DocumentPickerResult['assets']>[0];
const LAST_AI_RESPONSE_KEY = 'last_ai_response';

// MessageItem Komponente (robustere Text-Behandlung)
const MessageItem = memo(({ item }: { item: ChatMessage }) => {
    const messageText = item.text || '';
    return (
        <View style={[ styles.messageBubble, item.user._id === 1 ? styles.userMessage : styles.aiMessage ]}>
            {/* Rendere Text nur, wenn er nicht leer ist */}
            {messageText ? (
                 <Text style={item.user._id === 1 ? styles.userMessageText : styles.aiMessageText}>
                    {messageText}
                 </Text>
            ) : null}
            {/* Fallback für leere Nachrichten */}
            {!messageText && item.user._id !== 1 && (
                 <Text style={styles.aiMessageText}>...</Text>
            )}
        </View>
    );
});


const ChatScreen = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const { config, getCurrentApiKey, rotateApiKey } = useAI(); // Hol config und Funktionen direkt
  const { addLog } = useTerminal();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] = useState<DocumentResultAsset | null>(null);

  const loadClient = useCallback(async () => { setError(null); try { const c = await ensureSupabaseClient(); setSupabase(c); console.log("CS: Supa OK"); } catch (e:any) { setError("Supa Load Fail"); } }, []);
  useFocusEffect(useCallback(() => { loadClient(); }, [loadClient]));
  const handlePickDocument = async () => { try { const r=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory: true}); if(!r.canceled&&r.assets&&r.assets.length>0){const a=r.assets[0];setSelectedFileAsset(a);Alert.alert('Datei ok',`${a.name} (${a.size?(a.size/1024).toFixed(2)+' KB':'?'}) wird gesendet.`);}else{setSelectedFileAsset(null);}}catch(e){console.error('Pick Fail:',e);Alert.alert('Fehler','Datei Wahl fehlgeschlagen.');setSelectedFileAsset(null);}};

  // handleSend mit KORRIGIERTEM RETRY
  const handleSend = useCallback(async (isRetry = false, customPrompt?: string, keyToUse?: string | null) => {
    let userPrompt = customPrompt ?? textInput.trim();
    const fileToSend = selectedFileAsset;
    const displayPrompt = textInput.trim() || (fileToSend ? `(Datei gesendet: ${fileToSend.name})` : (customPrompt ? `Debug Anfrage` : ''));

    if (!userPrompt && !fileToSend && !customPrompt) return;
    if (!supabase) return;
    if (!isRetry) setError(null);

    const currentProvider = config.selectedProvider; // Immer aktuell aus config holen
    const apiKey = keyToUse ?? getCurrentApiKey(currentProvider);

    if (!apiKey) { Alert.alert('Key fehlt', `Kein API Key für ${currentProvider.toUpperCase()} gefunden.`); return; }

    let fileContent = ''; let combinedPrompt = userPrompt;
    if (fileToSend && !customPrompt && !isRetry) {
        setIsLoading(true); console.log(`Lese: ${fileToSend.uri}`);
        try { fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, { encoding: 'utf8' }); console.log(`Gelesen: ${fileContent.length} chars`); combinedPrompt = `--- Datei: ${fileToSend.name} ---\n${fileContent}\n--- Ende ---\n\n${userPrompt||'(Siehe Datei)'}`; }
        catch (readError: any) { console.error("Read Fail:",readError); Alert.alert("Lese-Fehler", `Datei "${fileToSend.name}" Error.`); setIsLoading(false); setSelectedFileAsset(null); return; }
    } else if (fileToSend && !customPrompt && isRetry) {
        combinedPrompt = userPrompt;
         if (displayPrompt === `(Datei gesendet: ${fileToSend.name})`) { userPrompt = displayPrompt; }
    }

    if (!isRetry) {
      const userMessage: ChatMessage = { _id: Math.random().toString(36).substring(7), text: displayPrompt || '...', createdAt: new Date(), user: { _id: 1, name: 'User' } };
      setMessages((prev) => [userMessage, ...prev]);
      setTextInput('');
      if(fileToSend && !customPrompt) setSelectedFileAsset(null);
    }

    setIsLoading(true);
    let effectiveModel = config.selectedMode; // Immer aktuell aus config holen
    if (currentProvider === 'groq' && effectiveModel === 'auto-groq'){ effectiveModel = 'llama-3.1-8b-instant'; console.log(`AutoGroq -> ${effectiveModel}`); }

    const currentKeyIndex = config.keys[currentProvider]?.indexOf(apiKey) ?? -1;
    console.log(`Sende: ${currentProvider}, ${effectiveModel}, KeyIdx:${currentKeyIndex !== -1 ? currentKeyIndex : '?'}`);

    try {
      const { data, error: funcErr } = await supabase.functions.invoke('k1w1-handler', { body: { message: combinedPrompt, apiKey: apiKey, provider: currentProvider, model: effectiveModel }, });
      if (funcErr) { const s = funcErr.context?.status||500; const d = funcErr.context?.details||funcErr.message; throw { name: 'FunctionsHttpError', status: s, message: d }; }

      const aiText = data?.response;
      if (aiText) {
        const aiMsg: ChatMessage = { _id: Math.random().toString(36).substring(7), text: aiText.trim(), createdAt: new Date(), user: { _id: 2, name: 'AI' } };
        setMessages((prev) => [aiMsg, ...prev]);
        try { await AsyncStorage.setItem(LAST_AI_RESPONSE_KEY, aiText.trim()); console.log("Letzte KI-Antwort gespeichert."); }
        catch (saveError) { console.error("Speicherfehler:", saveError); }
      } else { setError('Keine Antwort.'); console.warn('No Resp:', data); }

    } catch (e: any) {
        console.error('Send Fail:', e); let detailMsg = e.message||'?'; let status = e.status||500;
        if (status >= 400 && status < 500) {
            console.log(`Key Problem (${status}), rotiere...`); addLog(`Key ${currentProvider} (${status}). Rotiere...`);
            const nextKey = await rotateApiKey(currentProvider);
            if (nextKey && nextKey !== apiKey) {
                console.log("Retry new Key...");
                 if (fileToSend && !selectedFileAsset && !customPrompt) { console.log("Stelle Datei für Retry wieder her."); setSelectedFileAsset(fileToSend); }
                // *** BUGFIX HIER: Übergebe 'combinedPrompt' für Retry ***
                handleSend(true, combinedPrompt, nextKey);
                return;
             } else {
                 detailMsg = `Alle ${currentProvider.toUpperCase()} Keys verbraucht.`; Alert.alert("Keys leer", detailMsg); addLog(`Alle ${currentProvider} Keys leer.`);
                 if (fileToSend && !customPrompt) setSelectedFileAsset(null);
             }
        } else {
             Alert.alert('Sende-Fehler', detailMsg);
             if (fileToSend && !customPrompt) setSelectedFileAsset(null);
        }
        setError(detailMsg);
        if (!isRetry || detailMsg.includes("Alle Keys")) {
             setMessages(prev => prev.slice(1));
        }
    } finally { setIsLoading(false); }
  // Entferne selectedProvider/selectedMode aus Abhängigkeiten, da direkt aus config gelesen
  }, [textInput, supabase, getCurrentApiKey, rotateApiKey, addLog, config, selectedFileAsset, messages]);

  const handleDebugLastResponse = () => { const lastAiMsg = messages.find(m => m.user._id === 2); if (!lastAiMsg || !lastAiMsg.text) { Alert.alert("Nix da", "Keine KI Antwort zum Debuggen."); return; } const code = lastAiMsg.text; const prompt = `Analysiere Code auf Fehler, schlage Verbesserungen vor:\n\n\`\`\`\n${code}\n\`\`\``; setTextInput(`Debug: ${code.substring(0,30)}...`); handleSend(false, prompt); };

  const isSupabaseReady = supabase && !supabase.functions.invoke.toString().includes('DUMMY_CLIENT');

  // === START JSX ===
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"} style={styles.keyboardAvoidingContainer} keyboardVerticalOffset={Platform.OS === "ios" ? HEADER_HEIGHT + 20 : HEADER_HEIGHT + 40}>
        {!supabase && <ActivityIndicator style={styles.loadingIndicator} color={theme.palette.primary} size="large" />}
        <FlatList data={messages} renderItem={({ item }) => <MessageItem item={item} />} keyExtractor={(item) => item._id} inverted={true} style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" initialNumToRender={10} maxToRenderPerBatch={5} windowSize={10}/>
        {/* *** TEXT FEHLER FIX: Stelle sicher, dass error immer ein String ist *** */}
        {error && ( <View style={styles.errorContainer}><Text style={styles.error}>{String(error)}</Text></View> )}
        <View style={styles.inputContainerOuter}>
            {selectedFileAsset && ( <View style={styles.attachedFileContainer}><Ionicons name="document-attach-outline" size={16} color={theme.palette.text.secondary} /><Text style={styles.attachedFileText} numberOfLines={1}>{selectedFileAsset.name}</Text><TouchableOpacity onPress={()=>setSelectedFileAsset(null)} style={styles.removeFileButton}><Ionicons name="close-circle" size={18} color={theme.palette.text.secondary} /></TouchableOpacity></View> )}
            <View style={styles.inputContainerInner}>
                <TouchableOpacity onPress={handlePickDocument} style={styles.attachButton} disabled={isLoading}><Ionicons name="add-circle-outline" size={28} color={isLoading?theme.palette.text.disabled:theme.palette.primary} /></TouchableOpacity>
                 <TouchableOpacity onPress={handleDebugLastResponse} style={styles.debugButton} disabled={isLoading || messages.filter(m=>m.user._id === 2).length === 0}><Ionicons name="bug-outline" size={24} color={isLoading || messages.filter(m=>m.user._id === 2).length === 0 ? theme.palette.text.disabled : theme.palette.secondary} /></TouchableOpacity>
                <TextInput style={styles.input} placeholder={!supabase?"Lade...":(selectedFileAsset?"Zusätzl...":"Nachricht...")} placeholderTextColor={theme.palette.text.secondary} value={textInput} onChangeText={setTextInput} editable={!isLoading&&isSupabaseReady} multiline />
                <TouchableOpacity onPress={()=>handleSend(false)} disabled={isLoading || !isSupabaseReady || (!textInput.trim() && !selectedFileAsset)} style={[styles.sendButton, (!isSupabaseReady || isLoading || (!textInput.trim() && !selectedFileAsset)) && styles.sendButtonDisabled]} >{isLoading ? <ActivityIndicator size="small" color={theme.palette.background} /> : <Ionicons name="send" size={24} color={theme.palette.background} />}</TouchableOpacity>
            </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
  // === ENDE JSX ===
};

// Styles
const styles = StyleSheet.create({ /* ... unverändert ... */ safeArea:{flex:1,backgroundColor:theme.palette.background},keyboardAvoidingContainer:{flex:1},list:{flex:1},listContent:{paddingVertical:10,paddingHorizontal:10},messageBubble:{borderRadius:15,paddingVertical:10,paddingHorizontal:14,marginBottom:8,maxWidth:'80%'},userMessage:{backgroundColor:theme.palette.primary,alignSelf:'flex-end',borderBottomRightRadius:0},aiMessage:{backgroundColor:theme.palette.card,alignSelf:'flex-start',borderBottomLeftRadius:0},userMessageText:{fontSize:16,color:theme.palette.background},aiMessageText:{fontSize:16,color:theme.palette.text.primary},inputContainerOuter:{borderTopWidth:1,borderTopColor:theme.palette.card,backgroundColor:theme.palette.background},attachedFileContainer:{flexDirection:'row',alignItems:'center',backgroundColor:theme.palette.input.background,paddingVertical:6,paddingHorizontal:12,marginHorizontal:10,marginTop:8,borderRadius:15,borderWidth:1,borderColor:theme.palette.card},attachedFileText:{flex:1,marginLeft:8,marginRight:8,fontSize:13,color:theme.palette.text.secondary},removeFileButton:{padding:2},inputContainerInner:{flexDirection:'row',paddingHorizontal:10,paddingVertical:8,alignItems:'center'},attachButton:{paddingRight:5,justifyContent:'center',alignItems:'center',height:44},debugButton:{paddingHorizontal:8,justifyContent:'center',alignItems:'center',height:44},input:{flex:1,backgroundColor:theme.palette.input.background,borderRadius:20,paddingHorizontal:15,paddingVertical:Platform.OS==='ios'?10:8,color:theme.palette.text.primary,fontSize:16,maxHeight:100},sendButton:{backgroundColor:theme.palette.primary,borderRadius:25,width:44,height:44,justifyContent:'center',alignItems:'center',paddingLeft:3,marginLeft:5},sendButtonDisabled:{backgroundColor:theme.palette.text.secondary},errorContainer:{paddingHorizontal:10,paddingBottom:5},error:{color:theme.palette.error,textAlign:'center'},errorBanner:{backgroundColor:theme.palette.error,paddingVertical:10,paddingHorizontal:15},errorBannerText:{color:'white',textAlign:'center',fontWeight:'bold'},loadingIndicator:{marginVertical:30}, });

export default ChatScreen;

