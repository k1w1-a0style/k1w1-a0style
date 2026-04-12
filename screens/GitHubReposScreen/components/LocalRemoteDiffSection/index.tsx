import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../../theme";
import { styles } from "../../styles";
import { DiffPreviewModal } from "./DiffPreviewModal";
import { LocalRemoteDiffList } from "./LocalRemoteDiffList";
import { useLocalRemoteDiffModel } from "./useLocalRemoteDiffModel";
import { LocalRemoteDiffSectionProps } from "./types";

export function LocalRemoteDiffSection(props: LocalRemoteDiffSectionProps) {
  const { activeRepo, onPushSelected } = props;
  const {
    parsed,
    branch,
    local,
    loading,
    note,
    items,
    summary,
    visibleItems,
    showAll,
    inlineMode,
    selected,
    selectedCount,
    pushablePaths,
    inlineOpenAll,
    inlineOpenPath,
    inlineLoadingPath,
    preview,
    previewCacheRef,
    getPreviewCacheKey,
    setInlineMode,
    setShowAll,
    setInlineOpenPath,
    setInlineLoadingPath,
    collapseAllInline,
    expandAllInline,
    setAll,
    toggle,
    closePreview,
    load,
    openPreview,
  } = useLocalRemoteDiffModel(props);

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Diff Lokal ↔ Online</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {loading ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
          <TouchableOpacity testID="local-remote-diff-refresh" style={styles.iconBtn} onPress={load} disabled={!parsed || loading}>
            <Ionicons name="refresh" size={18} color={parsed ? theme.palette.primary : theme.palette.text.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18 }}>
        {activeRepo ? `${activeRepo}@${branch}` : "Repo wählen"}
        {local.length ? ` • Lokal: ${local.length} Dateien` : ""}
      </Text>

      {!!note ? (
        <Text style={{ fontSize: 11, marginTop: 8, color: theme.palette.text.muted, lineHeight: 16 }}>{note}</Text>
      ) : null}

      {items.length ? (
        <Text style={{ fontSize: 12, marginTop: 10, color: theme.palette.text.secondary, lineHeight: 18 }}>
          {summary.countsAreLowerBounds ? "≥ " : ""}✅ {summary.same} • {summary.countsAreLowerBounds ? "≥ " : ""}✏️ {summary.modified} • {summary.countsAreLowerBounds ? "≥ " : ""}➕ {summary.localOnly} • {summary.countsAreLowerBounds ? "≥ " : ""}⬇️ {summary.remoteOnly} • {summary.countsAreLowerBounds ? "≥ " : ""}⏭️ {summary.skipped} • {summary.countsAreLowerBounds ? "≥ " : ""}⚠️ {summary.error}
        </Text>
      ) : (
        <Text style={{ fontSize: 12, marginTop: 10, color: theme.palette.text.secondary, lineHeight: 18 }}>
          Drück Refresh für einen Vergleich (lokale Dateien gegen GitHub Datei-Inhalt).
        </Text>
      )}
      {summary.isPartial ? (
        <Text style={{ fontSize: 11, marginTop: 6, color: theme.palette.text.muted, lineHeight: 16 }}>
          {summary.partialReason || "Vergleich ist teilweise. Aus diesem Ergebnis darf kein Full-Sync-Fazit abgeleitet werden."}
        </Text>
      ) : null}

      <LocalRemoteDiffList
        items={items}
        visibleItems={visibleItems}
        inlineMode={inlineMode}
        showAll={showAll}
        inlineOpenAll={inlineOpenAll}
        inlineOpenPath={inlineOpenPath}
        inlineLoadingPath={inlineLoadingPath}
        selected={selected}
        pushablePaths={pushablePaths}
        selectedCount={selectedCount}
        onPushSelected={onPushSelected}
        previewCacheRef={previewCacheRef}
        getPreviewCacheKey={getPreviewCacheKey}
        setInlineMode={setInlineMode}
        setShowAll={setShowAll}
        collapseAllInline={collapseAllInline}
        expandAllInline={expandAllInline}
        setAll={setAll}
        toggle={toggle}
        setInlineOpenPath={setInlineOpenPath}
        setInlineLoadingPath={setInlineLoadingPath}
        openPreview={openPreview}
      />

      <DiffPreviewModal preview={preview} onClose={closePreview} />
    </View>
  );
}
