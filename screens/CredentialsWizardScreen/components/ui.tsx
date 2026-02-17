import React from "react";
import { LayoutAnimation, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "../../../theme";
import { styles } from "../styles";
import type { ModeDef, UiModeId } from "../types";

export function Spacer() {
  return <View style={{ height: theme.spacing.md }} />;
}

export function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "muted";
}) {
  const bg = tone === "success" ? "rgba(0,255,0,0.10)" : "rgba(255,255,255,0.06)";
  const border = tone === "success" ? "rgba(0,255,0,0.25)" : theme.palette.border;
  const color = tone === "success" ? theme.palette.text.primary : theme.palette.text.secondary;
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function InlineHint({
  icon,
  text,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: "muted" | "warning" | "danger";
}) {
  const color =
    tone === "danger" ? theme.palette.error : tone === "warning" ? theme.palette.warning : theme.palette.text.secondary;

  return (
    <View style={styles.inlineHint}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.inlineHintText, { color }]}>{text}</Text>
    </View>
  );
}

export function ModeSegmented({
  value,
  onChange,
  modes,
}: {
  value: UiModeId;
  onChange: (v: UiModeId) => void;
  modes: ModeDef[];
}) {
  return (
    <View style={styles.segmentWrap}>
      {modes.map((m) => {
        const on = m.id === value;
        return (
          <TouchableOpacity
            key={m.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            activeOpacity={0.9}
            onPress={() => {
              if (m.id === value) return;
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onChange(m.id);
            }}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{m.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  small,
  leftIcon,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  small?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      activeOpacity={0.86}
      style={[styles.btn, small && styles.btnSmall, styles.btnPrimary, disabled && styles.btnDisabled]}
    >
      {leftIcon ? <Ionicons name={leftIcon} size={16} color={theme.palette.primary} /> : null}
      <Text style={[styles.btnText, { color: theme.palette.primary }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  title,
  onPress,
  disabled,
  leftIcon,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      activeOpacity={0.86}
      style={[styles.btn, styles.btnSecondary, disabled && styles.btnDisabled]}
    >
      {leftIcon ? <Ionicons name={leftIcon} size={16} color={theme.palette.text.primary} /> : null}
      <Text style={[styles.btnText, { color: theme.palette.text.primary }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function TertiaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      activeOpacity={0.86}
      style={[styles.btn, styles.btnTertiary, disabled && styles.btnDisabled]}
    >
      <Text style={[styles.btnText, { color: theme.palette.text.secondary }]}>{title}</Text>
    </TouchableOpacity>
  );
}
