// screens/ChatScreen.tsx – Builder mit Rotation-Feedback + RichContext (UI + Hook)
import React, { useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { ChatMessage } from '../contexts/types';
import MessageItem from '../components/MessageItem';
import { useChatLogic } from '../hooks/useChatLogic';

const ChatScreen: React.FC = () => {
  const {
    messages,
    textInput,
    setTextInput,
    selectedFileAsset,
    handlePickDocument,
    handleSend,
    combinedIsLoading,
    error,
  } = useChatLogic();

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Scrollt nach neuen Nachrichten ans Ende, mit sauberem Cleanup
  useEffect(() => {
    let mounted = true;
    const scrollToEnd = () => {
      if (mounted && flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    };

    const timer = setTimeout(scrollToEnd, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [messages.length, messages]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageItem message={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!combinedIsLoading) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Builder arbeitet ...</Text>
      </View>
    );
  }, [combinedIsLoading]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior="height"
      keyboardVerticalOffset={80}
    >
      <View style={styles.container}>
        <View className="listContainer" style={styles.listContainer}>
          {combinedIsLoading && messages.length === 0 ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.palette.primary} />
              <Text style={styles.loadingOverlayText}>
                Projekt und Chat werden geladen ...
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={renderFooter}
            />
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                selectedFileAsset && styles.iconButtonActive,
              ]}
              onPress={handlePickDocument}
            >
              <Ionicons
                name="attach"
                size={20}
                color={
                  selectedFileAsset
                    ? theme.palette.primary
                    : theme.palette.text.secondary
                }
              />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Beschreibe, was der Builder tun soll ..."
              placeholderTextColor={theme.palette.text.secondary}
              multiline
            />

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={combinedIsLoading}
            >
              {combinedIsLoading ? (
                <ActivityIndicator size="small" color={theme.palette.secondary} />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={theme.palette.secondary}
                />
              )}
            </TouchableOpacity>
          </View>

          {selectedFileAsset && (
            <View style={styles.selectedFileBox}>
              <Text style={styles.selectedFileText}>
                📎 {selectedFileAsset.name}
              </Text>
            </View>
          )}
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
    padding: 12,
    paddingBottom: 16,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlayText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: theme.palette.text.secondary,
  },
  errorText: {
    color: theme.palette.error,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    paddingBottom: Platform.OS === 'android' ? 4 : 0,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  iconButtonActive: {
    borderColor: theme.palette.secondary,
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.palette.text.primary,
    fontSize: 14,
    backgroundColor: theme.palette.background,
  },
  sendButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedFileBox: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: theme.palette.card,
  },
  selectedFileText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
});

export default React.memo(ChatScreen);
