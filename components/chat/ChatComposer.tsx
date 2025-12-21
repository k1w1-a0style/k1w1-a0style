// components/chat/ChatComposer.tsx
import React, { useCallback } from "react";
import {
  Animated,
  ActivityIndicator,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { styles } from "../../styles/chatComposerStyles";

type Props = {
  textInput: string;
  onChangeText: (t: string) => void;
  pendingPlan: any | null;
  selectedFileAsset: any | null;
  onPickDocument: () => void;
  onClearSelectedFile: () => void;
  onSend: () => void | Promise<void>;
  combinedIsLoading: boolean;
  keyboardOffsetInScreen: number;
  sendButtonScale: Animated.Value;
};

const ChatComposer: React.FC<Props> = ({
  textInput,
  onChangeText,
  pendingPlan,
  selectedFileAsset,
  onPickDocument,
  onClearSelectedFile,
  onSend,
  combinedIsLoading,
  keyboardOffsetInScreen,
  sendButtonScale,
}) => {
  const placeholder = pendingPlan
    ? 'Antwort auf die Fragen... (oder "weiter")'
    : "Beschreibe deine App oder den nächsten Schritt ...";

  const handleSubmit = useCallback(
    (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      if (e.nativeEvent?.text?.trim()) onSend();
    },
    [onSend],
  );

  return (
    <View style={[styles.bottomArea, { bottom: keyboardOffsetInScreen }]}>
      {pendingPlan && (
        <View style={styles.planHint}>
          <Text style={styles.planHintText}>
            {
              '💡 Planer wartet: Beantworte kurz die Fragen oder tippe "weiter".'
            }
          </Text>
        </View>
      )}

      {selectedFileAsset && (
        <View style={styles.selectedFileBox}>
          <Ionicons name="document" size={16} color={theme.palette.primary} />
          <Text style={styles.selectedFileText} numberOfLines={1}>
            {selectedFileAsset.name}
          </Text>
          <TouchableOpacity onPress={onClearSelectedFile} activeOpacity={0.7}>
            <Ionicons
              name="close-circle"
              size={20}
              color={theme.palette.text.secondary}
            />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={[
            styles.iconButton,
            selectedFileAsset && styles.iconButtonActive,
          ]}
          onPress={onPickDocument}
          activeOpacity={0.7}
        >
          <Ionicons
            name="attach-outline"
            size={22}
            color={
              selectedFileAsset
                ? theme.palette.primary
                : theme.palette.text.secondary
            }
          />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor={theme.palette.text.secondary}
          value={textInput}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          blurOnSubmit={false}
          multiline
          maxLength={2000}
        />

        <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              combinedIsLoading && styles.sendButtonDisabled,
            ]}
            onPress={onSend}
            disabled={combinedIsLoading}
            activeOpacity={0.8}
          >
            {combinedIsLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.palette.background}
              />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={theme.palette.background}
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

export default ChatComposer;
