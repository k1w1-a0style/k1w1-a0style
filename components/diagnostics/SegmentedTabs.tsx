import React, { useMemo } from "react";
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

import { theme } from "../../theme";

export type TabKey = "overview" | "issues" | "fixes";

type Tab = { key: TabKey; label: string; badge?: number };

// NOTE: In der New Architecture ist setLayoutAnimationEnabledExperimental ein No-Op (warn spam).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isNewArch = !!(global as any)?.nativeFabricUIManager;
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental && !isNewArch) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function SegmentedTabs({
  value,
  onChange,
  tabs,
}: {
  value: TabKey;
  onChange: (key: TabKey) => void;
  tabs: Tab[];
}): React.ReactElement {
  const activeIndex = useMemo(() => tabs.findIndex((t) => t.key === value), [tabs, value]);

  return (
    <View style={styles.wrap}>
      {tabs.map((t, idx) => {
        const on = t.key === value;
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, on && styles.tabOn]}
            onPress={() => {
              if (t.key === value) return;
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onChange(t.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
            {typeof t.badge === "number" ? (
              <View style={[styles.badge, on && styles.badgeOn]}>
                <Text style={[styles.badgeText, on && styles.badgeTextOn]}>
                  {t.badge > 99 ? "99+" : String(t.badge)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
      {/* subtle indicator via border highlight – no absolute positioning to keep it robust */}
      {activeIndex < 0 ? null : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
  },
  tabOn: {
    backgroundColor: theme.palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.borderLight,
  },
  label: {
    color: theme.palette.text.secondary,
    fontWeight: "800",
    fontSize: 13,
  },
  labelOn: {
    color: theme.palette.text.primary,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  badgeOn: {
    backgroundColor: "rgba(0,255,0,0.10)",
    borderColor: "rgba(0,255,0,0.25)",
  },
  badgeText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "900",
  },
  badgeTextOn: {
    color: theme.palette.text.primary,
  },
});
