import React, { useCallback } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { describeRepoSecretContract } from "../../../../lib/diagnostics/buildPipelineDiagnostics";
import { theme } from "../../../../theme";
import { SecretRow, SecretsListVerificationState } from "./secretsSectionContracts";

export function SecretsChecklist(props: {
  requiredStatus: SecretRow[];
  optionalStatus: SecretRow[];
  listState: SecretsListVerificationState;
  requiredMissing: boolean;
  summaryColor: string;
}) {
  const { requiredStatus, optionalStatus, listState, requiredMissing, summaryColor } = props;

  const renderSecretRow = useCallback((entry: SecretRow, optional = false) => {
    const { contract, name } = entry;
    const presentation = describeRepoSecretContract({
      name,
      state: contract.state,
      optional,
    });

    const statusText =
      contract.state === "verified"
        ? "bestätigt"
        : contract.state === "missing"
          ? "fehlt"
          : contract.state === "auth_error"
            ? "auth-blockiert"
            : contract.state === "stale"
              ? "veraltet"
              : "unklar";

    const iconName =
      contract.state === "verified"
        ? "checkmark-circle"
        : contract.state === "missing"
          ? "close-circle"
          : contract.state === "auth_error"
            ? "lock-closed"
            : contract.state === "stale"
              ? "time"
              : "help-circle";

    const color =
      contract.state === "verified"
        ? theme.palette.primary
        : contract.state === "missing"
          ? optional
            ? theme.palette.warning
            : theme.palette.error
          : contract.state === "auth_error" || contract.state === "stale"
            ? theme.palette.warning
            : theme.palette.text.secondary;

    return (
      <View key={name} style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name={iconName} size={16} color={color} />
          <Text style={{ flex: 1, fontSize: 12, color: theme.palette.text.secondary }}>{name}</Text>
          <Text style={{ fontSize: 11, fontWeight: "800", color }}>{statusText}</Text>
        </View>
        {presentation.fixHint ? (
          <Text
            style={{
              marginLeft: 24,
              fontSize: 11,
              lineHeight: 16,
              color:
                presentation.status === "pass"
                  ? theme.palette.text.secondary
                  : presentation.status === "fail"
                    ? theme.palette.error
                    : theme.palette.warning,
            }}
          >
            {presentation.fixHint}
          </Text>
        ) : null}
      </View>
    );
  }, []);

  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "800",
          color:
            listState === "verified"
              ? requiredMissing
                ? theme.palette.error
                : theme.palette.primary
              : listState === "auth_error" || listState === "stale"
                ? theme.palette.warning
                : theme.palette.text.secondary,
        }}
      >
        Required
      </Text>

      {requiredStatus.map((entry) => renderSecretRow(entry))}

      {optionalStatus.length ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: listState === "verified" ? theme.palette.text.secondary : summaryColor,
            }}
          >
            Optional
          </Text>
          {optionalStatus.map((entry) => renderSecretRow(entry, true))}
        </View>
      ) : null}
    </View>
  );
}
