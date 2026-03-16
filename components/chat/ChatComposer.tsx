// components/chat/ChatComposer.tsx
import React, { useCallback, useRef } from "react";
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
import type { PendingPlan } from "../../hooks/useChatAIFlow";

type Props = {
  textInput: string;
  onChangeText: (t: string) => void;
  pendingPlan: PendingPlan | null;
  selectedFileAsset: { name: string } | null;
  onPickDocument: () => void;
  onClearSelectedFile: () => void;
  onSend: () => void | Promise<void>;
  combinedIsLoading: boolean;
  keyboardOffsetInScreen: number;
  sendButtonScale: Animated.Value;
  onHeightChange?: (h: number) => void;
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
  onHeightChange,
}) => {
  const hasMessage = textInput.trim().length > 0;
  const canSend = !combinedIsLoading && (hasMessage || !!selectedFileAsset);

  const sendColor = canSend ? theme.palette.primary : theme.palette.text.secondary;

  const placeholder = pendingPlan
    ? 'Antwort auf die Fragen... (oder "weiter")'
    : "Beschreibe deine App oder den nächsten Schritt ...";

  const lastH = useRef<number>(0);

  const handleSubmit = useCallback(
    (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      const nextText = e.nativeEvent?.text ?? "";
      if (nextText.trim().length > 0 || !!selectedFileAsset) onSend();
    },
    [onSend, selectedFileAsset],
  );

  return (
    <View
      style={[styles.bottomArea, { bottom: keyboardOffsetInScreen }]}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (!onHeightChange) return;

        if (Math.abs(h - lastH.current) >= 1) {
          lastH.current = h;
          onHeightChange(h);
        }
      }}
    >
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
        <View
          style={styles.selectedFileBox}
          accessibilityLabel={`Ausgewählte Datei: ${selectedFileAsset.name}`}
        >
          <Ionicons name="document" size={16} color={theme.palette.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedFileText} numberOfLines={1}>
              {selectedFileAsset.name}
            </Text>
            <Text style={[styles.selectedFileText, { fontSize: 11, opacity: 0.75 }]} numberOfLines={1}>
              Hinweis: Aktuell wird nur Dateiname/Metadaten gesendet
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClearSelectedFile}
            activeOpacity={0.7}
            accessibilityLabel="Dateiauswahl entfernen"
            accessibilityRole="button"
          >
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
          accessibilityLabel="Datei anhängen"
          accessibilityRole="button"
          accessibilityHint="Öffnet die Dateiauswahl"
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
          accessibilityLabel="Nachricht eingeben"
          accessibilityHint={placeholder}
        />

        <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
            ]}
            onPress={onSend}
            disabled={!canSend}
            activeOpacity={0.8}
            accessibilityLabel={combinedIsLoading ? "Wird verarbeitet" : "Nachricht senden"}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
          >
            {combinedIsLoading ? (
              <ActivityIndicator
                size="small"
                color={sendColor}
              />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={sendColor}
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

export default ChatComposer;
