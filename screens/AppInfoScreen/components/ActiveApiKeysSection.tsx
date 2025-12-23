import React from "react";
import { Text, View } from "react-native";
import { PROVIDER_METADATA, type AIConfig } from "../../../contexts/AIContext";
import { styles } from "../styles";
import { PROVIDERS } from "../constants";

export const ActiveApiKeysSection = ({ config }: { config: AIConfig }) => {
  return (
    <View style={styles.apiKeysContainer}>
      <Text style={styles.apiKeysDescription}>
        Alle aktuell integrierten und aktiven API-Keys (der erste Key wird
        verwendet):
      </Text>

      {PROVIDERS.map((provider) => {
        const keys = config.apiKeys[provider] || [];
        const metadata = PROVIDER_METADATA[provider];

        return (
          <View key={provider} style={styles.providerKeySection}>
            <View style={styles.providerHeader}>
              <Text style={styles.providerEmoji}>{metadata.emoji}</Text>
              <Text style={styles.providerName}>{metadata.label}</Text>
              <View style={styles.keyCountBadge}>
                <Text style={styles.keyCountText}>{keys.length}</Text>
              </View>
            </View>

            {keys.length === 0 ? (
              <Text style={styles.noKeysText}>Keine Keys konfiguriert</Text>
            ) : (
              <View style={styles.keysList}>
                {keys.map((key, index) => (
                  <View key={index} style={styles.keyItem}>
                    <View style={styles.keyItemHeader}>
                      <Text style={styles.keyIndexLabel}>
                        {index === 0 ? "🟢 Aktiv" : `#${index + 1}`}
                      </Text>
                    </View>
                    <Text style={styles.keyText} numberOfLines={1}>
                      {key}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};
