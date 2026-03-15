import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { PROVIDER_METADATA } from "../../../contexts/AIContext";

import { PROVIDER_IDS, styles, type ProviderId } from "../styles";

import type { ProviderStatusView } from "../hooks/settingsHelpers";

type Props = {
  selectedProvider: ProviderId;
  onSelect: (provider: ProviderId) => void;
  apiKeys: Record<string, string[]>;
  getProviderStatus: (provider: ProviderId) => ProviderStatusView;
};

export function ProviderTiles({
  selectedProvider,
  onSelect,
  apiKeys,
  getProviderStatus,
}: Props) {
  return (
    <View>
      {PROVIDER_IDS.map((id) => {
        const meta = PROVIDER_METADATA?.[id];
        if (!meta) return null;

        const status = getProviderStatus(id);
        const keyCount = (apiKeys?.[id] ?? []).length;
        const isSelected = id === selectedProvider;

        const lampStyle = status.limitReached
          ? styles.statusLampAlert
          : keyCount > 0
            ? styles.statusLampOk
            : styles.statusLampIdle;

        return (
          <TouchableOpacity
            key={id}
            onPress={() => onSelect(id)}
            activeOpacity={0.85}
            style={[styles.providerTile, isSelected && styles.providerTileActive]}
          >
            <View style={styles.providerTop}>
              <View style={[styles.statusLamp, lampStyle]} />
              <Text style={styles.providerTitle}>
                {meta.emoji} {meta.label}
              </Text>
            </View>

            <Text style={styles.providerDesc}>{meta.description}</Text>

            <View style={styles.providerFoot}>
              <Text style={styles.providerKeys}>
                Keys: <Text style={styles.providerKeysStrong}>{keyCount}</Text>
              </Text>
              {status.limitReached && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>LIMIT</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
