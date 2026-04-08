import React, { useCallback } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../../theme";
import { RuntimeCredentialRow } from "./secretsSectionContracts";

function RuntimeSourceRow(props: {
  label: "Repo Secret" | "Lokaler App-Wert";
  state: RuntimeCredentialRow["repoContract"]["state"] | "present" | "missing" | "loading";
  copy: string;
}) {
  const { label, state, copy } = props;

  const iconName =
    state === "verified" || state === "present"
      ? "checkmark-circle"
      : state === "missing"
        ? "close-circle"
        : state === "auth_error"
          ? "lock-closed"
          : state === "stale" || state === "loading"
            ? "time"
            : "help-circle";

  const color =
    state === "verified" || state === "present"
      ? theme.palette.primary
      : state === "missing"
        ? theme.palette.warning
        : state === "auth_error" || state === "stale"
          ? theme.palette.warning
          : theme.palette.text.secondary;

  const statusText =
    state === "verified"
      ? "bestätigt"
      : state === "present"
        ? "vorhanden"
        : state === "missing"
          ? "fehlt"
          : state === "auth_error"
            ? "auth-blockiert"
            : state === "stale"
              ? "veraltet"
              : state === "loading"
                ? "lädt"
                : "unklar";

  return (
    <View
      style={{
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: `${color}33`,
        backgroundColor: `${color}10`,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={iconName} size={15} color={color} />
        <Text style={{ flex: 1, fontSize: 11, fontWeight: "800", color: theme.palette.text.primary }}>
          {label}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: "900", color }}>{statusText}</Text>
      </View>
      <Text style={{ fontSize: 11, lineHeight: 16, color: theme.palette.text.secondary }}>{copy}</Text>
    </View>
  );
}

export function RuntimeCredentialsCard({ row }: { row: RuntimeCredentialRow }) {
  const localState = useCallback(() => {
    if (row.localPresent === null) return "loading" as const;
    return row.localPresent ? "present" : "missing";
  }, [row.localPresent]);

  return (
    <View
      style={{
        gap: 8,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${theme.palette.primary}22`,
        backgroundColor: theme.palette.card,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: theme.palette.text.primary }}>{row.title}</Text>
      <View style={{ gap: 6 }}>
        <RuntimeSourceRow label="Repo Secret" state={row.repoContract.state} copy={row.repoCopy} />
        <RuntimeSourceRow label="Lokaler App-Wert" state={localState()} copy={row.localCopy} />
      </View>
      <Text style={{ fontSize: 11, lineHeight: 17, color: theme.palette.text.secondary }}>{row.usageCopy}</Text>
    </View>
  );
}
