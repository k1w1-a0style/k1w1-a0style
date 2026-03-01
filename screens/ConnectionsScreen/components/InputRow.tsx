import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import type { ConnectionsStyles } from "./types";

export function InputRow(props: {
  styles: ConnectionsStyles;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  showToggle?: boolean;
  onToggleShow?: () => void;
  isShown?: boolean;
  rightHint?: string;
  multiline?: boolean;
}) {
  const {
    styles,
    label,
    value,
    onChangeText,
    placeholder,
    secure,
    showToggle,
    onToggleShow,
    isShown,
    rightHint,
    multiline,
  } = props;

  const secureTextEntry = secure && !isShown;

  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.inputHeader}>
        <Text style={styles.label}>{label}</Text>
        {rightHint ? <Text style={styles.hintInline}>{rightHint}</Text> : null}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.palette.input.placeholder}
          style={[
            styles.input,
            multiline && { minHeight: 88, textAlignVertical: "top" },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          multiline={!!multiline}
        />
        {showToggle ? (
          <TouchableOpacity
            onPress={onToggleShow}
            style={styles.eyeBtn}
            accessibilityLabel="Toggle token visibility"
          >
            <Ionicons
              name={isShown ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
