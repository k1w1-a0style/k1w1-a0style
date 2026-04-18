// components/chat/ChatComposer.tsx
import React, { useCallback, useRef } from "react";
import {
  Animated,
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

type GuardWriteStatus = "normal" | "guarded";

type Props = {
  textInput: string;
  onChangeText: (t: string) => void;
  pendingPlan: PendingPlan | null;
  guardWriteStatus?: GuardWriteStatus;
  selectedFileAsset: { name: string } | null;
  onPickDocument: () => void;
  onClearSelectedFile: () => void;
  onSend: () => void | Promise<void>;
  onAbort?: () => void;
  combinedIsLoading: boolean;
  keyboardOffsetInScreen: number;
  sendButtonScale: Animated.Value;
  onHeightChange?: (h: number) => void;
};

const ChatComposer: React.FC<Props> = ({
  textInput,
  onChangeText,
  pendingPlan,
  guardWriteStatus = "normal",
  selectedFileAsset,
  onPickDocument,
  onClearSelectedFile,
  onSend,
  onAbort,
  combinedIsLoading,
  keyboardOffsetInScreen,
  sendButtonScale,
  onHeightChange,
}) => {
  const hasMessage = textInput.trim().length > 0;
  const charLimit = 2000;
  const charCount = textInput.length;
  const charsRemaining = charLimit - charCount;
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
      <View style={styles.guardBadgeRow}>
        <View
          style={[
            styles.guardBadge,
            guardWriteStatus === "guarded" ? styles.guardBadgeWarn : styles.guardBadgeOk,
          ]}
          accessibilityLabel={
            guardWriteStatus === "guarded"
              ? "Schreibstatus: Guarded path enthalten"
              : "Schreibstatus: Normal write"
          }
        >
          <Text style={styles.guardBadgeText}>
            {guardWriteStatus === "guarded" ? "Guarded path enthalten" : "Normal write"}
          </Text>
        </View>
      </View>

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
          testID="chat-composer-clear-attachment-button"
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
          testID="chat-composer-attach-button"
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
          maxLength={charLimit}
          accessibilityLabel="Nachricht eingeben"
          accessibilityHint={placeholder}
        />

        <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
          <TouchableOpacity
            testID={combinedIsLoading ? "chat-composer-abort-button" : "chat-composer-send-button"}
            style={[
              styles.sendButton,
              !canSend && !combinedIsLoading && styles.sendButtonDisabled,
            ]}
            onPress={combinedIsLoading ? (onAbort ?? (() => {})) : onSend}
            disabled={!canSend && !combinedIsLoading}
            activeOpacity={0.8}
            accessibilityLabel={combinedIsLoading ? "Anfrage abbrechen" : "Nachricht senden"}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend && !combinedIsLoading }}
          >
            {combinedIsLoading ? (
              <Ionicons
                name="close"
                size={20}
                color={theme.palette.error}
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

      <Text
        style={[
          styles.charCounter,
          charsRemaining <= 120 && styles.charCounterWarning,
          charsRemaining <= 40 && styles.charCounterCritical,
        ]}
        accessibilityLabel={`Verbleibende Zeichen: ${charsRemaining}`}
      >
        {charsRemaining}
      </Text>

    </View>
  );
};

export default ChatComposer;
