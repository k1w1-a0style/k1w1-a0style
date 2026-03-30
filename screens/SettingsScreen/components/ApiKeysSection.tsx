import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { maskApiKey } from "../../../lib/apiKeyMasking";

import type { AllAIProviders } from "../../../contexts/AIContext";
import { PROVIDER_METADATA } from "../../../contexts/AIContext";
import { theme } from "../../../theme";
import { styles } from "../styles";

const PROVIDER_IDS: AllAIProviders[] = [
  "groq",
  "gemini",
  "openai",
  "anthropic",
  "huggingface",
];

type Props = {
  apiKeys: Record<string, string[]>;
  selectedProvider: AllAIProviders;
  setSelectedProvider: React.Dispatch<React.SetStateAction<AllAIProviders>>;
  newKey: string;
  setNewKey: (value: string) => void;
  keys: string[];
  hasMultipleKeys: boolean;
  onAddKey: () => Promise<void> | void;
  onRemoveKey: (key: string) => Promise<void> | void;
  onRotateKey: () => Promise<void> | void;
  onMoveKeyToFront: (key: string, index: number) => Promise<void> | void;
};

export const ApiKeysSection: React.FC<Props> = ({
  apiKeys,
  selectedProvider,
  setSelectedProvider,
  newKey,
  setNewKey,
  keys,
  hasMultipleKeys,
  onAddKey,
  onRemoveKey,
  onRotateKey,
  onMoveKeyToFront,
}) => {
  const [revealedKeys, setRevealedKeys] = React.useState<Set<number>>(new Set());
  const [isInputRevealed, setIsInputRevealed] = React.useState(false);

  React.useEffect(() => {
    // Reset reveal state when switching provider or key list changes.
    setRevealedKeys(new Set());
    setIsInputRevealed(false);
  }, [selectedProvider, keys.length]);

  const toggleRevealKey = (index: number) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.h2}>API Keys</Text>

      <View style={styles.providerPickerRow}>
        {PROVIDER_IDS.map((p) => {
          const isActive = p === selectedProvider;
          const meta = PROVIDER_METADATA[p];
          const keyCount = (apiKeys?.[p] ?? []).length;

          return (
            <TouchableOpacity
              key={p}
              onPress={() => setSelectedProvider(p)}
              style={[styles.providerChip, isActive && styles.providerChipActive]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.providerChipText,
                  isActive && styles.providerChipTextActive,
                ]}
              >
                {meta?.emoji ?? "🔑"} {meta?.label ?? p}{" "}
                <Text style={{ color: theme.palette.text.secondary }}>
                  ({keyCount})
                </Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.keyRow}>
        <View style={{ flex: 1, position: "relative" }}>
          <TextInput
            value={newKey}
            onChangeText={setNewKey}
            placeholder="API Key einfügen…"
            placeholderTextColor={theme.palette.text.secondary}
            style={[styles.keyInput, { paddingRight: 44 }]}
            autoCapitalize="none"
            autoCorrect={false}
            multiline={false}
            secureTextEntry={!isInputRevealed}
            autoComplete="off"
            textContentType="none"
          />

          <TouchableOpacity
            onPress={() => setIsInputRevealed((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              top: 0,
              bottom: 0,
              width: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
            activeOpacity={0.85}
            accessibilityLabel={isInputRevealed ? "Hide API key input" : "Show API key input"}
          >
            <Ionicons
              name={isInputRevealed ? "eye-off" : "eye"}
              size={18}
              color={theme.palette.text.secondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.keyAddBtn}
          onPress={() => {
            setIsInputRevealed(false);
            void onAddKey();
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#000" />
          <Text style={styles.keyAddBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyList}>
        {keys.length === 0 ? (
          <Text style={styles.emptyText}>Noch keine Keys gespeichert.</Text>
        ) : (
          keys.map((k, i) => (
            <View key={`${k}-${i}`} style={styles.keyItem}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  style={styles.keyText}
                  numberOfLines={1}
                  accessibilityLabel="API key display"
                >
                  {revealedKeys.has(i) ? k : maskApiKey(k)}
                </Text>

                <TouchableOpacity
                  onPress={() => toggleRevealKey(i)}
                  style={styles.keyActionBtn}
                  activeOpacity={0.85}
                  accessibilityLabel={revealedKeys.has(i) ? "Hide API key" : "Show API key"}
                >
                  <Ionicons
                    name={revealedKeys.has(i) ? "eye-off" : "eye"}
                    size={16}
                    color={theme.palette.text.secondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.keyActions}>
                {hasMultipleKeys && i !== 0 && (
                  <TouchableOpacity
                    onPress={() => onMoveKeyToFront(k, i)}
                    style={styles.keyActionBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="flash" size={16} color={theme.palette.primary} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => onRemoveKey(k)}
                  style={[styles.keyActionBtn, styles.keyActionDanger]}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash" size={16} color={theme.palette.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.rotateBtn}
        onPress={() => onRotateKey()}
        activeOpacity={0.85}
      >
        <Ionicons name="refresh" size={18} color="#000" />
        <Text style={styles.rotateBtnText}>Key rotieren</Text>
      </TouchableOpacity>

      <Text style={styles.tokenPreview}>
        Hinweis: Anzeige “LIMIT” kommt nur, wenn dein Rate-Limiter/Status das meldet.
      </Text>
    </View>
  );
};
