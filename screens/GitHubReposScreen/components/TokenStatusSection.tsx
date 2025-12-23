import React, { memo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface TokenStatusSectionProps {
  tokenLoading: boolean;
  token: string | null;
  tokenError: string | null;
  loadingRepos: boolean;
  loadRepos: () => void;
}

export const TokenStatusSection = memo(function TokenStatusSection({
  tokenLoading,
  token,
  tokenError,
  loadingRepos,
  loadRepos,
}: TokenStatusSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>GitHub Token</Text>

      {tokenLoading ? (
        <View style={styles.tokenLoader}>
          <ActivityIndicator size="small" color={theme.palette.primary} />
        </View>
      ) : (
        <>
          <Text style={styles.tokenText}>
            {token
              ? "✅ Token vorhanden (siehe Verbindungen-Screen)"
              : '⚠️ Kein Token gesetzt. Bitte in „Verbindungen" speichern.'}
          </Text>
          {!!tokenError && <Text style={styles.errorText}>{tokenError}</Text>}
        </>
      )}

      <TouchableOpacity
        style={[styles.button, loadingRepos && styles.buttonDisabled]}
        onPress={loadRepos}
        disabled={loadingRepos}
      >
        {loadingRepos ? (
          <ActivityIndicator size="small" color={theme.palette.primary} />
        ) : (
          <>
            <Ionicons
              name="refresh"
              size={18}
              color={theme.palette.text.primary}
            />
            <Text style={styles.buttonText}>Repos laden</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
});
