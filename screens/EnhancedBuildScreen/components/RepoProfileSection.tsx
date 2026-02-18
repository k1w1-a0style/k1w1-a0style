import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import type { BuildProfile } from "../types";

const PROFILES: { id: BuildProfile; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "development", label: "Development", icon: "code-slash-outline" },
  { id: "preview", label: "Preview", icon: "eye-outline" },
  { id: "production", label: "Production", icon: "rocket-outline" },
];

export function BuildModeDropdown({
  value,
  onChange,
}: {
  value: BuildProfile;
  onChange: (p: BuildProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.timing(rotateAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const current = PROFILES.find((p) => p.id === value) ?? PROFILES[0];
  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={s.wrap}>
      <TouchableOpacity style={s.selector} onPress={toggle} activeOpacity={0.7}>
        <Ionicons name={current.icon} size={16} color={theme.palette.primary} />
        <View style={s.selectorText}>
          <Text style={s.label}>Build Modus</Text>
          <Text style={s.value}>{current.label}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="chevron-down" size={18} color={theme.palette.text.secondary} />
        </Animated.View>
      </TouchableOpacity>

      {open && (
        <View style={s.dropdown}>
          {PROFILES.map((p) => {
            const active = p.id === value;
            return (
              <TouchableOpacity
                key={p.id}
                style={[s.item, active && s.itemActive]}
                onPress={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={p.icon}
                  size={16}
                  color={active ? theme.palette.primary : theme.palette.text.secondary}
                />
                <Text style={[s.itemText, active && s.itemTextActive]}>{p.label}</Text>
                {active && (
                  <Ionicons name="checkmark" size={16} color={theme.palette.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function RepoInfoBadge({
  repoFullName,
  branchName,
}: {
  repoFullName: string;
  branchName: string;
}) {
  if (!repoFullName) {
    return (
      <View style={s.infoBadge}>
        <Ionicons name="alert-circle-outline" size={14} color={theme.palette.warning} />
        <Text style={s.infoMissing}>Kein Repo verknuepft</Text>
      </View>
    );
  }
  return (
    <View style={s.infoBadge}>
      <Ionicons name="logo-github" size={14} color={theme.palette.text.primary} />
      <Text style={s.infoRepo}>{repoFullName}</Text>
      {!!branchName && (
        <>
          <Ionicons name="git-branch-outline" size={12} color={theme.palette.text.muted} />
          <Text style={s.infoBranch}>{branchName}</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    overflow: "hidden",
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  selectorText: { flex: 1, gap: 2 },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.palette.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.palette.primary,
  },
  dropdown: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.palette.border,
  },
  itemActive: {
    backgroundColor: "rgba(0,255,0,0.05)",
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  itemTextActive: {
    color: theme.palette.primary,
    fontWeight: "900",
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
  },
  infoRepo: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  infoBranch: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  infoMissing: {
    color: theme.palette.warning,
    fontSize: 13,
    fontWeight: "700",
  },
});
