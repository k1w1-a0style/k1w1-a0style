import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  PROVIDER_METADATA,
  type AllAIProviders,
} from "../../../contexts/AIContext";
import { maskApiKey } from "../../../lib/apiKeyMasking";

type Props = {
  styles: any;
  config: {
    apiKeys: Record<string, string[]>;
  };
};

const PROVIDERS: AllAIProviders[] = [
  "groq",
  "gemini",
  "openai",
  "anthropic",
  "huggingface",
];

const AUTO_HIDE_MS = 10_000;

export function ActiveApiKeysSection({ styles, config }: Props) {
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      const refs = timeoutRefs.current;
      Object.keys(refs).forEach((k) => clearTimeout(refs[k]));
    };
  }, []);

  const toggleReveal = (provider: AllAIProviders) => {
    setRevealedKeys((prev) => {
      const next = { ...prev, [provider]: !prev[provider] };

      // Auto-hide nach kurzer Zeit (sicherer bei Screenshots/Support)
      if (next[provider]) {
        if (timeoutRefs.current[provider]) {
          clearTimeout(timeoutRefs.current[provider]);
        }
        timeoutRefs.current[provider] = setTimeout(() => {
          setRevealedKeys((p) => ({ ...p, [provider]: false }));
        }, AUTO_HIDE_MS);
      }

      return next;
    });
  };

  return (
    <>
      {/* AKTIVE API KEYS */}
      <Text style={styles.sectionTitle}>🔑 Aktive API-Keys</Text>
      <View style={styles.apiKeysContainer}>
        <Text style={styles.apiKeysDescription}>
          Alle aktuell integrierten und aktiven API-Keys (der erste Key wird
          verwendet):
        </Text>

        {PROVIDERS.map((provider) => {
          const keys = config.apiKeys?.[provider] || [];
          const metadata = PROVIDER_METADATA[provider];
          const isRevealed = Boolean(revealedKeys[provider]);

          return (
            <View key={provider} style={styles.providerKeySection}>
              <View style={styles.providerHeader}>
                <Text style={styles.providerEmoji}>{metadata.emoji}</Text>
                <Text style={styles.providerName}>{metadata.label}</Text>
                <View style={styles.keyCountBadge}>
                  <Text style={styles.keyCountText}>{keys.length}</Text>
                </View>

                {keys.length > 0 && (
                  <Pressable
                    onPress={() => toggleReveal(provider)}
                    style={styles.revealButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isRevealed
                        ? `API-Keys für ${metadata.label} ausblenden`
                        : `API-Keys für ${metadata.label} anzeigen`
                    }
                  >
                    <Ionicons
                      name={isRevealed ? "eye-off" : "eye"}
                      size={18}
                      color="#666"
                    />
                  </Pressable>
                )}
              </View>

              {keys.length === 0 ? (
                <Text style={styles.noKeysText}>Keine Keys konfiguriert</Text>
              ) : (
                <View style={styles.keysList}>
                  {keys.map((key: string, index: number) => (
                    <View key={index} style={styles.keyItem}>
                      <View style={styles.keyItemHeader}>
                        <Text style={styles.keyIndexLabel}>
                          {index === 0 ? "🟢 Aktiv" : `#${index + 1}`}
                        </Text>
                      </View>
                      <Text style={styles.keyText} numberOfLines={1}>
                        {isRevealed ? key : maskApiKey(key)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </>
  );
}
