import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";

export type CheckItem = {
  id: string;
  label: string;
  status: "pending" | "ok" | "fail" | "running";
  detail?: string;
};

function CheckRow({ item, index }: { item: CheckItem; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  useEffect(() => {
    if (item.status === "running") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [item.status, pulseAnim]);

  const iconName =
    item.status === "ok"
      ? "checkmark-circle"
      : item.status === "fail"
        ? "close-circle"
        : item.status === "running"
          ? "ellipse"
          : "ellipse-outline";

  const iconColor =
    item.status === "ok"
      ? theme.palette.success
      : item.status === "fail"
        ? theme.palette.error
        : item.status === "running"
          ? theme.palette.warning
          : theme.palette.text.disabled;

  return (
    <Animated.View
      style={[
        s.row,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
        item.status === "ok" && s.rowOk,
      ]}
    >
      <Animated.View style={{ opacity: item.status === "running" ? pulseAnim : 1 }}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </Animated.View>
      <View style={s.rowTextWrap}>
        <Text
          style={[
            s.rowLabel,
            item.status === "ok" && s.rowLabelOk,
            item.status === "fail" && s.rowLabelFail,
          ]}
        >
          {item.label}
        </Text>
        {item.detail ? <Text style={s.rowDetail}>{item.detail}</Text> : null}
      </View>
    </Animated.View>
  );
}

export function ChecklistSection({ items }: { items: CheckItem[] }) {
  const allOk = items.every((i) => i.status === "ok");

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons
          name="list-outline"
          size={18}
          color={allOk ? theme.palette.success : theme.palette.primary}
        />
        <Text style={s.title}>Pre-Build Checkliste</Text>
        {allOk && (
          <View style={s.allOkBadge}>
            <Text style={s.allOkText}>BEREIT</Text>
          </View>
        )}
      </View>
      <View style={s.list}>
        {items.map((item, idx) => (
          <CheckRow key={item.id} item={item} index={idx} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  title: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 15,
    flex: 1,
  },
  allOkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.success,
    backgroundColor: "rgba(0,255,0,0.08)",
  },
  allOkText: {
    color: theme.palette.success,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  list: { gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowOk: {
    borderColor: "rgba(0,255,0,0.12)",
    backgroundColor: "rgba(0,255,0,0.03)",
  },
  rowTextWrap: { flex: 1 },
  rowLabel: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    fontWeight: "700",
  },
  rowLabelOk: { color: theme.palette.text.primary },
  rowLabelFail: { color: theme.palette.error },
  rowDetail: {
    color: theme.palette.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
});
