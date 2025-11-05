// screens/ChatScreen.tsx (V12 - Korrigierte Reihenfolge & Scroll)
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { ensureSupabaseClient } from '../lib/supabase';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';
import { useProject } from '../contexts/ProjectContext';
import MessageItem from '../components/MessageItem';
import { useChatHandlers } from '../hooks/useChatHandlers';

type DocumentResultAsset = NonNullable<import('expo-document-picker').DocumentPickerResult['assets']>[0];

type ChatScreenProps = {
  navigation: any;
  route: { params?: { debugCode?: string } };
};

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const { messages, isLoading: isProjectLoading, projectData } = useProject();
  const flatListRef = useRef<FlatList>(null);
  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] = useState<DocumentResultAsset | null>(null);

  const {
    handlePickDocument,
    handleSend,
    handleDebugLastResponse,
    handleExpoGo,
  } = useChatHandlers(
    supabase,
    textInput,
    setTextInput,
    selectedFileAsset,
    setSelectedFileAsset,
    setIsAiLoading,
    setError
  );

  const loadClient = useCallback(async () => {
    setError(null);
    try {
      setSupabase(await ensureSupabaseClient());
      console.log('CS: Supabase OK');
    } catch (e: any) {
      setError('Supabase Fehler');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClient();
    }, [loadClient])
  );

  // Auto-Scroll nach unten bei neuen Nachrichten
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    if (route.params?.debugCode) {
      const code = route.params.debugCode;
      console.log('CS: Debug vom CodeScreen');
      const debugPrompt = `Analysiere:\n\n\`\`\`\n${code}\n\`\`\``;
      setTextInput('Debug Anfrage...');
      handleSend(debugPrompt);
      navigation.setParams({ debugCode: undefined });
    }
  }, [route.params?.debugCode, navigation, handleSend]);

  const isSupabaseReady = supabase && !supabase.functions.invoke.toString().includes('DUMMY_CLIENT');
  const combinedIsLoading = isAiLoading || isProjectLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageItem item={item} />}
        keyExtractor={item => item.id}
        inverted={false}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
      />

      {(!supabase || (isProjectLoading && messages.length === 0)) && (
        <ActivityIndicator
          style={styles.loadingIndicator}
          color={theme.palette.primary}
          size="large"
        />
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{String(error)}</Text>
        </View>
      )}

      <View style={styles.inputWrapper}>
        {selectedFileAsset && (
          <View style={styles.attachedFileContainer}>
            <Ionicons name="document-attach-outline" size={14} color={theme.palette.text.secondary} />
            <Text style={styles.attachedFileText} numberOfLines={1}>{selectedFileAsset.name}</Text>
            <TouchableOpacity onPress={() => setSelectedFileAsset(null)} style={styles.removeFileButton}>
              <Ionicons name="close-circle" size={16} color={theme.palette.text.secondary} />
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
              name="add-circle-outline"
              size={22}
              color={combinedIsLoading ? theme.palette.text.disabled : theme.palette.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDebugLastResponse}
            style={styles.iconButton}
            disabled={combinedIsLoading || messages.filter(m => m.role === 'assistant').length === 0}
          >
            <Ionicons
              name="bug-outline"
              size={20}
              color={combinedIsLoading || messages.filter(m => m.role === 'assistant').length === 0 ? theme.palette.text.disabled : theme.palette.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExpoGo}
            style={styles.iconButton}
            disabled={!projectData || combinedIsLoading}
          >
            <Ionicons
              name="logo-react"
              size={20}
              color={!projectData || combinedIsLoading ? theme.palette.text.disabled : theme.palette.success}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={!isSupabaseReady ? 'Verbinde...' : selectedFileAsset ? 'Zusatz...' : 'Nachricht...'}
            placeholderTextColor={theme.palette.text.secondary}
            value={textInput}
            onChangeText={setTextInput}
            editable={!combinedIsLoading && isSupabaseReady}
            multiline
            blurOnSubmit={false}
            maxHeight={80}
            textAlignVertical="center"
          />

          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={combinedIsLoading || !isSupabaseReady || (!textInput.trim() && !selectedFileAsset)}
            style={[
              styles.sendButton,
              (!isSupabaseReady || combinedIsLoading || (!textInput.trim() && !selectedFileAsset)) && styles.sendButtonDisabled
            ]}
          >
            {isAiLoading ? (
              <ActivityIndicator size="small" color={theme.palette.background} />
            ) : (
              <Ionicons name="send" size={18} color={theme.palette.background} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    zIndex: 10,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 5,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 20 : 4,
  },
  attachedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.input.background + '60',
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginHorizontal: 6,
    marginTop: 2,
    marginBottom: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  attachedFileText: {
    flex: 1,
    marginLeft: 4,
    marginRight: 4,
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  removeFileButton: {
    padding: 0
  },
  inputContainerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  iconButton: {
    padding: 5,
    marginHorizontal: 2,
  },
  input: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 5 : 4,
    paddingTop: Platform.OS === 'ios' ? 5 : 4,
    color: theme.palette.text.primary,
    fontSize: 14,
    minHeight: 32,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 4,
    marginLeft: 2,
  },
  sendButton: {
    backgroundColor: theme.palette.primary,
    borderRadius: 15,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  sendButtonDisabled: {
    backgroundColor: theme.palette.text.disabled
  },
  errorContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: theme.palette.error + '20',
    position: 'absolute',
    bottom: 80,
    left: 10,
    right: 10,
    borderRadius: 6,
    zIndex: 5,
  },
  errorText: {
    color: theme.palette.error,
    textAlign: 'center',
    fontSize: 12
  },
});

export default ChatScreen;
