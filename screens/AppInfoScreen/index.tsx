import React from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { PROVIDER_METADATA, type AllAIProviders } from "../../contexts/AIContext";
import type { TemplateId } from "../../contexts/types";
import { resolveEffectiveTemplateId } from "../../lib/templateChecklist";

import { useAppInfoScreen } from "./hooks/useAppInfoScreen";
import { styles } from "./styles";
import { TEMPLATE_INFO } from "./types";

export default function AppInfoScreen() {
  const {
    projectData,
    appName,
    setAppName,
    packageName,
    setPackageNameState,
    iconPreview,
    setIconPreview,
    handleSaveAppName,
    handleSavePackageName,
    handleChooseIcon,
    handleExportAPIConfig,
    handleImportAPIConfig,
    handleExportFullBackup,
    handleImportFullBackup,
    fileCount,
    messageCount,    assetsStatus,
    config,
  } = useAppInfoScreen();

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {/* APP SETTINGS */}
        <Text style={styles.sectionTitle}>📱 App-Einstellungen</Text>

        <View style={styles.settingsContainer}>
          <Text style={styles.label}>App Name:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={appName}
              onChangeText={setAppName}
              placeholder="Meine App"
              placeholderTextColor={theme.palette.text.secondary}
            />
            <TouchableOpacity
              onPress={handleSaveAppName}
              style={styles.saveButton}
            >
              <Ionicons
                name="checkmark"
                size={24}
                color={theme.palette.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingsContainer}>
          <Text style={styles.label}>Package Name (Slug):</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={packageName}
              onChangeText={setPackageNameState}
              placeholder="meine-app"
              placeholderTextColor={theme.palette.text.secondary}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={handleSavePackageName}
              style={styles.saveButton}
            >
              <Ionicons
                name="checkmark"
                size={24}
                color={theme.palette.primary}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Ändert package.json (name) und app.config.js (slug, package)
          </Text>
        </View>

        <View style={styles.settingsContainer}>
          <Text style={styles.label}>App Icon & Assets:</Text>
          <TouchableOpacity
            onPress={handleChooseIcon}
            style={styles.iconButton}
          >
            {iconPreview ? (
              <Image
                source={{ uri: iconPreview }}
                style={styles.iconPreview}
                onError={() => {
                  setIconPreview(null);
                }}
              />
            ) : (
              <View style={styles.iconPlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={theme.palette.text.secondary}
                />
              </View>
            )}
            <Text style={styles.iconButtonText}>
              {iconPreview ? "App Assets ändern..." : "App Assets auswählen..."}
            </Text>
          </TouchableOpacity>

          {/* Assets Status */}
          <View style={styles.assetsStatus}>
            <Text style={styles.assetsStatusTitle}>Gesetzte Assets:</Text>
            <View style={styles.assetsStatusList}>
              <View style={styles.assetStatusItem}>
                <Ionicons
                  name={assetsStatus.icon ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={
                    assetsStatus.icon
                      ? theme.palette.success
                      : theme.palette.error
                  }
                />
                <Text style={styles.assetStatusText}>icon.png</Text>
              </View>
              <View style={styles.assetStatusItem}>
                <Ionicons
                  name={
                    assetsStatus.adaptiveIcon
                      ? "checkmark-circle"
                      : "close-circle"
                  }
                  size={16}
                  color={
                    assetsStatus.adaptiveIcon
                      ? theme.palette.success
                      : theme.palette.error
                  }
                />
                <Text style={styles.assetStatusText}>adaptive-icon.png</Text>
              </View>
              <View style={styles.assetStatusItem}>
                <Ionicons
                  name={
                    assetsStatus.splash ? "checkmark-circle" : "close-circle"
                  }
                  size={16}
                  color={
                    assetsStatus.splash
                      ? theme.palette.success
                      : theme.palette.error
                  }
                />
                <Text style={styles.assetStatusText}>splash.png</Text>
              </View>
              <View style={styles.assetStatusItem}>
                <Ionicons
                  name={
                    assetsStatus.favicon ? "checkmark-circle" : "close-circle"
                  }
                  size={16}
                  color={
                    assetsStatus.favicon
                      ? theme.palette.success
                      : theme.palette.error
                  }
                />
                <Text style={styles.assetStatusText}>favicon.png</Text>
              </View>
            </View>
          </View>
        </View>

        {/* FULL BACKUP & RESTORE */}
        <Text style={styles.sectionTitle}>🔐 Voll-Backup (ALLE Tokens)</Text>
        <View style={styles.apiBackupContainer}>
          <Text style={styles.apiBackupDescription}>
            Exportiert/Importiert wirklich alles: GitHub/Expo/Supabase/AI Tokens +
            Connections + AI Config.
          </Text>
          <Text style={styles.hint}>
            ⚠️ Enthält Secrets im Klartext. Datei nur sicher speichern!
          </Text>

          <View style={styles.apiBackupButtons}>
            <TouchableOpacity
              onPress={handleExportFullBackup}
              style={styles.backupButton}
            >
              <Ionicons
                name="download-outline"
                size={20}
                color={theme.palette.primary}
              />
              <Text style={styles.backupButtonText}>Voll-Export</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImportFullBackup}
              style={[styles.backupButton, styles.restoreButton]}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={theme.palette.warning}
              />
              <Text style={[styles.backupButtonText, styles.restoreButtonText]}>
                Voll-Import
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* API BACKUP & RESTORE */}
        <Text style={styles.sectionTitle}>
          💾 API-Backup & Wiederherstellung
        </Text>
        <View style={styles.apiBackupContainer}>
          <Text style={styles.apiBackupDescription}>
            Exportiere oder importiere nur die AI/API-Konfiguration als Datei.
          </Text>

          <View style={styles.apiBackupButtons}>
            <TouchableOpacity
              onPress={handleExportAPIConfig}
              style={styles.backupButton}
            >
              <Ionicons
                name="download-outline"
                size={20}
                color={theme.palette.primary}
              />
              <Text style={styles.backupButtonText}>Exportieren</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImportAPIConfig}
              style={[styles.backupButton, styles.restoreButton]}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={theme.palette.warning}
              />
              <Text style={[styles.backupButtonText, styles.restoreButtonText]}>
                Importieren
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AKTIVE API KEYS */}
        <Text style={styles.sectionTitle}>🔑 Aktive API-Keys</Text>
        <View style={styles.apiKeysContainer}>
          <Text style={styles.apiKeysDescription}>
            Alle aktuell integrierten und aktiven API-Keys (der erste Key wird
            verwendet):
          </Text>

          {(
            [
              "groq",
              "gemini",
              "openai",
              "anthropic",
              "huggingface",
            ] as AllAIProviders[]
          ).map((provider) => {
            const keys = config.apiKeys[provider] || [];
            const metadata = PROVIDER_METADATA[provider];

            return (
              <View key={provider} style={styles.providerKeySection}>
                <View style={styles.providerHeader}>
                  <Text style={styles.providerEmoji}>{metadata.emoji}</Text>
                  <Text style={styles.providerName}>{metadata.label}</Text>
                  <View style={styles.keyCountBadge}>
                    <Text style={styles.keyCountText}>{keys.length}</Text>
                  </View>
                </View>

                {keys.length === 0 ? (
                  <Text style={styles.noKeysText}>Keine Keys konfiguriert</Text>
                ) : (
                  <View style={styles.keysList}>
                    {keys.map((key: string, index: number) => (
                      <View key={index} style={styles.keyItem}>
                        <View style={styles.keyItemHeader}>
                          <Text style={styles.keyIndexLabel}>
                            {index === 0 ? "🟢 Aktiv" : `#${index + 1}`}
                          </Text>
                        </View>
                        <Text style={styles.keyText} numberOfLines={1}>
                          {key}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* TEMPLATE-INFO */}
        <Text style={styles.sectionTitle}>📦 Projekt-Template</Text>
        <View style={styles.templateInfoContainer}>
			{(() => {
				const templateId = (projectData?.templateId || 'auto') as TemplateId;
				const { mode, effective } = resolveEffectiveTemplateId(
					templateId,
					projectData?.files || []
				);
				const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
				const badge = mode === 'auto' ? `Auto (${cap(effective)})` : cap(effective);

				return (
					<>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>Aktiv:</Text>
							<Text style={styles.infoValue}>{badge}</Text>
						</View>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>Modus:</Text>
							<Text style={styles.infoValue}>{mode === 'auto' ? 'Auto' : 'Manuell'}</Text>
						</View>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>Effektiv:</Text>
							<Text style={styles.infoValue}>{cap(effective)}</Text>
						</View>
					</>
				);
			})()}
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

        {/* PROJEKT-INFO */}
        <Text style={styles.sectionTitle}>ℹ️ Aktuelles Projekt</Text>
        <View style={styles.projectInfoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Projekt-ID:</Text>
            <Text style={styles.infoValueMono} numberOfLines={1}>
              {projectData?.id
                ? projectData.id.substring(0, 13) + "..."
                : "N/A"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dateien:</Text>
            <Text style={styles.infoValue}>{fileCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nachrichten:</Text>
            <Text style={styles.infoValue}>{messageCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Letzte Änderung:</Text>
            <Text style={styles.infoValueMono} numberOfLines={1}>
              {projectData?.lastModified
                ? new Date(projectData.lastModified).toLocaleString("de-DE")
                : "N/A"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

}
