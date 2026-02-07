import React from "react";
import { View, Text } from "react-native";

import type { TemplateId } from "../../../contexts/types";
import { resolveEffectiveTemplateId } from "../../../lib/templateChecklist";
import { TEMPLATE_INFO } from "../types";

type Props = {
  styles: any;
  projectData: any;
  fileCount: number;
};

export function TemplateInfoSection({ styles, projectData, fileCount }: Props) {
  const templateId = (projectData?.templateId || "auto") as TemplateId;
  const { mode, effective } = resolveEffectiveTemplateId(
    templateId,
    projectData?.files || []
  );

  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const badge = mode === "auto" ? `Auto (${cap(effective)})` : cap(effective);

  return (
    <>
      {/* TEMPLATE-INFO */}
      <Text style={styles.sectionTitle}>📦 Projekt-Template</Text>
      <View style={styles.templateInfoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Aktiv:</Text>
          <Text style={styles.infoValue}>{badge}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Modus:</Text>
          <Text style={styles.infoValue}>{mode === "auto" ? "Auto" : "Manuell"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Effektiv:</Text>
          <Text style={styles.infoValue}>{cap(effective)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Expo SDK:</Text>
          <Text style={styles.infoValue}>{TEMPLATE_INFO.sdkVersion}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>React Native:</Text>
          <Text style={styles.infoValue}>{TEMPLATE_INFO.rnVersion}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Standard-Dateien:</Text>
          <Text style={styles.infoValue}>{fileCount}</Text>
        </View>

        <Text style={styles.infoHint}>
          ℹ️ Auto (Full) ist Standard – es wird immer das <Text style={styles.inlineCode}>Full</Text>-Template verwendet.
        </Text>
      </View>
    </>
  );
}
