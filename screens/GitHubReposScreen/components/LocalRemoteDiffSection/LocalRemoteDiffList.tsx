import React from "react";
import { View, Text, TouchableOpacity, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../../theme";
import { styles } from "../../styles";
import { diffLineStyle, statusColor, statusGlyph } from "./diffAlgorithms";
import { DiffItem, PreviewCacheEntry } from "./types";

type Props = {
  items: DiffItem[];
  visibleItems: DiffItem[];
  inlineMode: boolean;
  showAll: boolean;
  inlineOpenAll: boolean;
  inlineOpenPath: string | null;
  inlineLoadingPath: string | null;
  selected: Record<string, boolean>;
  pushablePaths: string[];
  selectedCount: number;
  onPushSelected?: (paths: string[]) => void;
  previewCacheRef: React.MutableRefObject<Map<string, PreviewCacheEntry>>;
  getPreviewCacheKey: (path: string) => string;
  setInlineMode: (updater: (prev: boolean) => boolean) => void;
  setShowAll: (updater: (prev: boolean) => boolean) => void;
  collapseAllInline: () => void;
  expandAllInline: () => void;
  setAll: (on: boolean) => void;
  toggle: (path: string) => void;
  setInlineOpenPath: (path: string | null) => void;
  setInlineLoadingPath: (path: string | null) => void;
  openPreview: (item: DiffItem, opts?: { silent?: boolean }) => Promise<void>;
};

export function LocalRemoteDiffList(props: Props) {
  const {
    items,
    visibleItems,
    inlineMode,
    showAll,
    inlineOpenAll,
    inlineOpenPath,
    inlineLoadingPath,
    selected,
    pushablePaths,
    selectedCount,
    onPushSelected,
    previewCacheRef,
    getPreviewCacheKey,
    setInlineMode,
    setShowAll,
    collapseAllInline,
    expandAllInline,
    setAll,
    toggle,
    setInlineOpenPath,
    setInlineLoadingPath,
    openPreview,
  } = props;

  return (
    <FlatList
      data={visibleItems.slice(0, 24)}
      keyExtractor={(i) => `${i.status}:${i.path}`}
      style={{ marginTop: 12 }}
      stickyHeaderIndices={[0]}
      ListHeaderComponent={
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingTop: 4,
            paddingBottom: 10,
            backgroundColor: theme.palette.card,
          }}
        >
          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={() => {
              setInlineMode((v) => !v);
              collapseAllInline();
            }}
            disabled={!items.length}
          >
            <Ionicons
              name={inlineMode ? "git-compare-outline" : "open-outline"}
              size={14}
              color={items.length ? theme.palette.text.secondary : theme.palette.text.muted}
            />
            <Text style={{ fontSize: 12, color: items.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
              {inlineMode ? "Inline" : "Modal"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={expandAllInline}
            disabled={!items.length || !inlineMode}
          >
            <Ionicons
              name="add-circle-outline"
              size={14}
              color={items.length && inlineMode ? theme.palette.text.secondary : theme.palette.text.muted}
            />
            <Text style={{ fontSize: 12, color: items.length && inlineMode ? theme.palette.text.secondary : theme.palette.text.muted }}>
              Expand
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={collapseAllInline}
            disabled={!items.length || !inlineMode}
          >
            <Ionicons
              name="remove-circle-outline"
              size={14}
              color={items.length && inlineMode ? theme.palette.text.secondary : theme.palette.text.muted}
            />
            <Text style={{ fontSize: 12, color: items.length && inlineMode ? theme.palette.text.secondary : theme.palette.text.muted }}>
              Collapse
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={() => setShowAll((v) => !v)}
            disabled={!items.length}
          >
            <Ionicons
              name={showAll ? "eye-off-outline" : "eye-outline"}
              size={14}
              color={items.length ? theme.palette.text.secondary : theme.palette.text.muted}
            />
            <Text style={{ fontSize: 12, color: items.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
              {showAll ? "Nur Änderungen" : "Alle"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={() => setAll(true)}
            disabled={!items.length || !pushablePaths.length}
          >
            <Ionicons
              name="checkbox-outline"
              size={14}
              color={items.length && pushablePaths.length ? theme.palette.text.secondary : theme.palette.text.muted}
            />
            <Text style={{ fontSize: 12, color: items.length && pushablePaths.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
              Alle Änderungen
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={() => setAll(false)}
            disabled={!items.length || !pushablePaths.length}
          >
            <Ionicons
              name="square-outline"
              size={14}
              color={items.length && pushablePaths.length ? theme.palette.text.secondary : theme.palette.text.muted}
            />
            <Text style={{ fontSize: 12, color: items.length && pushablePaths.length ? theme.palette.text.secondary : theme.palette.text.muted }}>
              Keine
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={() => {
              const paths = Object.entries(selected)
                .filter(([, v]) => !!v)
                .map(([k]) => k);
              if (!paths.length) {
                Alert.alert("⚠️", "Keine Dateien ausgewählt.");
                return;
              }
              onPushSelected?.(paths);
            }}
            disabled={!items.length || !selectedCount || !onPushSelected}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={14}
              color={items.length && selectedCount && onPushSelected ? theme.palette.primary : theme.palette.text.muted}
            />
            <Text
              style={{
                fontSize: 12,
                color: items.length && selectedCount && onPushSelected ? theme.palette.text.secondary : theme.palette.text.muted,
              }}
            >
              Push ({selectedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
            onPress={async () => {
              const text = items.map((i) => `${statusGlyph(i.status)} ${i.path}`).join("\n");
              await Clipboard.setStringAsync(text);
            }}
            disabled={!items.length}
          >
            <Ionicons name="copy-outline" size={14} color={items.length ? theme.palette.text.secondary : theme.palette.text.muted} />
            <Text style={{ fontSize: 12, color: items.length ? theme.palette.text.secondary : theme.palette.text.muted }}>Liste</Text>
          </TouchableOpacity>

          {items.length > 24 ? (
            <TouchableOpacity
              style={[styles.chip, { flexDirection: "row", gap: 6, alignItems: "center" }]}
              onPress={() => {
                Alert.alert(
                  "Lokale vs Online Diff",
                  items.map((i) => `${statusGlyph(i.status)} ${i.path}${i.detail ? ` (${i.detail})` : ""}`).join("\n"),
                );
              }}
            >
              <Ionicons name="list-outline" size={14} color={theme.palette.text.secondary} />
              <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>Alle</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      }
      renderItem={({ item: i }) => {
        const pushable = i.status === "modified" || i.status === "localOnly";
        const checked = !!selected[i.path];
        const isOpen = inlineMode && (inlineOpenAll || inlineOpenPath === i.path);
        const cached = previewCacheRef.current.get(getPreviewCacheKey(i.path));
        const needsLoad = inlineMode && isOpen && !cached;
        return (
          <View style={{ marginBottom: 2 }}>
            <Pressable
              onPress={async () => {
                if (!inlineMode) {
                  await openPreview(i);
                  return;
                }

                const p = i.path;
                if (!inlineOpenAll) {
                  if (inlineOpenPath === p) {
                    setInlineOpenPath(null);
                    return;
                  }
                  setInlineOpenPath(p);
                }

                const c = previewCacheRef.current.get(getPreviewCacheKey(p));
                if (!c) {
                  setInlineLoadingPath(p);
                  try {
                    await openPreview(i, { silent: true });
                  } finally {
                    setInlineLoadingPath(null);
                  }
                }
              }}
              style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 6 }}
            >
              <Pressable
                onPress={() => {
                  if (pushable) toggle(i.path);
                  else {
                    void openPreview(i);
                  }
                }}
                style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
              >
                {pushable ? (
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={18}
                    color={checked ? theme.palette.primary : theme.palette.text.muted}
                  />
                ) : (
                  <Ionicons name="search-outline" size={16} color={theme.palette.text.muted} />
                )}
              </Pressable>

              <Text style={{ width: 18, textAlign: "center", color: statusColor(i.status), fontWeight: "900" }}>
                {statusGlyph(i.status)}
              </Text>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: theme.palette.text.secondary }} numberOfLines={1}>
                  {i.path}
                </Text>
                {!!i.detail ? (
                  <Text style={{ fontSize: 11, color: theme.palette.text.muted }} numberOfLines={1}>
                    {i.detail}
                  </Text>
                ) : null}
              </View>

              {pushable ? (
                <Text style={{ color: theme.palette.text.muted, fontSize: 11 }}>push</Text>
              ) : i.status === "remoteOnly" ? (
                <Text style={{ color: theme.palette.text.muted, fontSize: 11 }}>pull</Text>
              ) : null}
            </Pressable>

            {isOpen ? (
              <View
                style={{
                  marginLeft: 30,
                  marginBottom: 8,
                  marginTop: 4,
                  borderLeftWidth: 2,
                  borderLeftColor: theme.palette.border,
                  paddingLeft: 10,
                }}
              >
                {inlineLoadingPath === i.path ? (
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <ActivityIndicator size="small" />
                    <Text style={{ color: theme.palette.text.muted, fontSize: 12 }}>Lade Diff…</Text>
                  </View>
                ) : (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: theme.palette.border,
                      borderRadius: 10,
                      padding: 10,
                      backgroundColor: theme.palette.backgroundDark,
                    }}
                  >
                    {needsLoad ? (
                      <TouchableOpacity
                        style={[styles.button, { paddingVertical: 8 }]}
                        onPress={async () => {
                          setInlineLoadingPath(i.path);
                          try {
                            await openPreview(i, { silent: true });
                          } finally {
                            setInlineLoadingPath(null);
                          }
                        }}
                      >
                        <Ionicons name="download-outline" size={16} color={theme.palette.text.secondary} />
                        <Text style={styles.buttonText}>Diff laden</Text>
                      </TouchableOpacity>
                    ) : null}

                    {(previewCacheRef.current.get(getPreviewCacheKey(i.path))?.diff || (needsLoad ? "" : "(keine Vorschau)"))
                      .split("\n")
                      .slice(0, 220)
                      .map((ln, idx) => (
                        <Text key={idx} style={[{ fontFamily: "monospace", fontSize: 11, lineHeight: 16 }, diffLineStyle(ln)]}>
                          {ln}
                        </Text>
                      ))}
                  </View>
                )}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.button, { flex: 1, paddingVertical: 8 }]}
                    onPress={async () => {
                      const cached2 = previewCacheRef.current.get(getPreviewCacheKey(i.path));
                      const t = cached2?.diff || "";
                      await Clipboard.setStringAsync(t);
                      Alert.alert("✅", "Diff kopiert.");
                    }}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.palette.text.secondary} />
                    <Text style={styles.buttonText}>Diff kopieren</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.button, { flex: 1, paddingVertical: 8 }]} onPress={() => void openPreview(i)}>
                    <Ionicons name="open-outline" size={16} color={theme.palette.text.secondary} />
                    <Text style={styles.buttonText}>Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        );
      }}
      ListFooterComponent={
        visibleItems.length > 24 ? (
          <Text style={{ fontSize: 11, color: theme.palette.text.muted, marginTop: 6 }}>+{visibleItems.length - 24} weitere…</Text>
        ) : null
      }
    />
  );
}
