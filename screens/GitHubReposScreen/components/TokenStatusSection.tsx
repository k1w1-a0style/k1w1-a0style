import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface TokenStatusSectionProps {
  tokenLoading: boolean;
  token: string | null;
  tokenError: string | null;
}

export function TokenStatusSection({
  tokenLoading,
  token,
  tokenError,
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
          {tokenError && <Text style={styles.errorText}>{tokenError}</Text>}
        </>
      )}
    </View>
  );
}
