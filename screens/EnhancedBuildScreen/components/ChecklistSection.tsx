import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";

export type CheckItem = {
  id: string;
  label: string;
  status: "pending" | "ok" | "fail" | "running";
  detail?: string;
};

export type CheckActionChip = {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  /** short status marker like FEHLT / EMPFOHLEN */
  badge?: string;
};

type ChipsById = Record<string, CheckActionChip[]>;

const FIX_ORDER = ["repo", "tokens", "signing_key", "diagnostic", "ci_lite"] as const;
const statusWeight: Record<CheckItem["status"], number> = {
  fail: 0,
  pending: 1,
  running: 2,
  ok: 3,
};

function statusTag(status: CheckItem["status"]): { text: string; tone: "error" | "info" | "warn" } | null {
  if (status === "fail") return { text: "FEHLT", tone: "error" };
  if (status === "pending") return { text: "EMPFOHLEN", tone: "info" };
  if (status === "running") return { text: "LÄUFT", tone: "warn" };
  return null;
}

function CheckRow({
  item,
  index,
  chips,
}: {
  item: CheckItem;
  index: number;
  chips?: CheckActionChip[];
}) {
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

  const rowTag = statusTag(item.status);

  return (
    <Animated.View
      style={[
        s.row,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
        item.status === "ok" && s.rowOk,
        item.status === "fail" && s.rowFail,
      ]}
    >
      <Animated.View style={{ opacity: item.status === "running" ? pulseAnim : 1 }}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </Animated.View>

      <View style={s.rowTextWrap}>
        <View style={s.rowTitleLine}>
          <Text
            style={[
              s.rowLabel,
              item.status === "ok" && s.rowLabelOk,
              item.status === "fail" && s.rowLabelFail,
            ]}
          >
            {item.label}
          </Text>

          {rowTag ? (
            <View
              style={[
                s.rowTag,
                rowTag.tone === "error" && s.rowTagError,
                rowTag.tone === "info" && s.rowTagInfo,
                rowTag.tone === "warn" && s.rowTagWarn,
              ]}
            >
              <Text style={s.rowTagText}>{rowTag.text}</Text>
            </View>
          ) : null}
        </View>

        {item.detail ? <Text style={s.rowDetail}>{item.detail}</Text> : null}

        {chips && chips.length > 0 && item.status !== "ok" ? (
          <View style={s.chipsRow}>
            {chips.map((c) => (
              <Pressable
                key={c.id}
                onPress={c.disabled ? undefined : c.onPress}
                disabled={!!c.disabled}
                android_ripple={{ color: "rgba(255,255,255,0.08)", borderless: false }}
                style={({ pressed }) => [
                  s.chip,
                  pressed && !c.disabled && s.chipPressed,
                  c.disabled && s.chipDisabled,
                ]}
              >
                {c.icon ? (
                  <Ionicons name={c.icon} size={14} color={theme.palette.text.primary} />
                ) : null}
                <Text style={s.chipText}>{c.label}</Text>

                {c.badge ? (
                  <View style={s.chipBadge}>
                    <Text style={s.chipBadgeText}>{c.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function ChecklistSection({
  items,
  actionChipsById,
}: {
  items: CheckItem[];
  actionChipsById?: ChipsById;
}) {
  const chipsById = useMemo(() => actionChipsById ?? ({} as ChipsById), [actionChipsById]);
  const allOk = items.every((i) => i.status === "ok");

  const sortedItems = useMemo(() => {
    if (allOk) return items;

    const fixIndex = (id: string) => {
      const idx = FIX_ORDER.indexOf(id as any);
      return idx === -1 ? 1000 : idx;
    };

    // Keep stable order by using original index as tiebreaker
    const withIdx = items.map((it, idx) => ({ it, idx }));
    withIdx.sort((a, b) => {
      const w = statusWeight[a.it.status] - statusWeight[b.it.status];
      if (w !== 0) return w;

      const fi = fixIndex(a.it.id) - fixIndex(b.it.id);
      if (fi !== 0) return fi;

      return a.idx - b.idx;
    });

    return withIdx.map((x) => x.it);
  }, [allOk, items]);

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
        {sortedItems.map((item, idx) => (
          <CheckRow key={item.id} item={item} index={idx} chips={chipsById[item.id]} />
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
  rowFail: {
    borderColor: "rgba(255,0,0,0.18)",
    backgroundColor: "rgba(255,0,0,0.04)",
  },
  rowTextWrap: { flex: 1 },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  rowLabelOk: { color: theme.palette.text.primary },
  rowLabelFail: { color: theme.palette.error },
  rowDetail: {
    color: theme.palette.text.muted,
    fontSize: 11,
    marginTop: 2,
  },

  rowTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rowTagError: {
    borderColor: theme.palette.error,
    backgroundColor: "rgba(255,0,0,0.08)",
  },
  rowTagInfo: {
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,150,255,0.08)",
  },
  rowTagWarn: {
    borderColor: theme.palette.warning,
    backgroundColor: "rgba(255,170,0,0.10)",
  },
  rowTagText: {
    color: theme.palette.text.primary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  chipText: {
    color: theme.palette.text.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  chipBadge: {
    marginLeft: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipBadgeText: {
    color: theme.palette.text.secondary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});
